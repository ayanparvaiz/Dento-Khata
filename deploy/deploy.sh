#!/usr/bin/env bash
# One-shot VPS deploy for the dental app.
# Runs FROM your Mac. Syncs source -> VPS, builds, migrates+seeds, starts via pm2,
# writes an nginx vhost for the domain, and issues HTTPS via certbot.
# Safe alongside other apps (e.g. ichat): own port, own pm2 process, own nginx block.
#
# Usage:
#   deploy/deploy.sh                # uses defaults below
#   SSH_TARGET=ubuntu@1.2.3.4 deploy/deploy.sh
#   SEED=force deploy/deploy.sh     # reseed demo data even if a DB exists
set -euo pipefail

# ===================== config (override via env) =====================
SSH_TARGET="${SSH_TARGET:-dentist@dentist.devcenter.dev}"  # who/where to deploy
DOMAIN="${DOMAIN:-dentist.devcenter.dev}"                  # A-record points here
PORT="${PORT:-4100}"                                       # internal port (NOT ichat's)
APP_DIR="${APP_DIR:-/home/dentist/apps/dentist-app}"       # code lives here (dentist owns it)
DATA_DIR="${DATA_DIR:-/home/dentist/dentist-data}"         # DB+uploads+backups (survive redeploys)
PM2_NAME="${PM2_NAME:-dentist-api}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-contact@finallyfreeproductions.com}"
SEED="${SEED:-auto}"                                       # auto | force | never
# =====================================================================

REPO="$(cd "$(dirname "$0")/.." && pwd)"
echo "==> Repo:        $REPO"
echo "==> Target:      $SSH_TARGET"
echo "==> Domain:      $DOMAIN  (internal :$PORT)"
echo "==> Data dir:    $DATA_DIR  (persistent)"

# 1) Sync source (skip build artifacts, node_modules, local DB)
echo "==> [1/3] Syncing source…"
ssh "$SSH_TARGET" "mkdir -p '$APP_DIR' '$DATA_DIR'"
rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' \
  --exclude 'frontend/dist' --exclude 'backend/dist' \
  --exclude '/data' --exclude '*.db' --exclude '*.db-*' \
  --exclude 'e2e/shots' --exclude 'e2e/node_modules' \
  "$REPO/" "$SSH_TARGET:$APP_DIR/"

# 2) Build + db + pm2 (runs on the server)
echo "==> [2/3] Building & starting on server…"
ssh "$SSH_TARGET" \
  DOMAIN="$DOMAIN" PORT="$PORT" APP_DIR="$APP_DIR" DATA_DIR="$DATA_DIR" \
  PM2_NAME="$PM2_NAME" SEED="$SEED" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# --- toolchain (idempotent) ---
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pnpm >/dev/null || sudo npm i -g pnpm
command -v pm2  >/dev/null || sudo npm i -g pm2
command -v nginx >/dev/null || sudo apt-get install -y nginx
command -v rsync >/dev/null || sudo apt-get install -y rsync

cd "$APP_DIR"

# --- install + build ---
# Use npm on the server: pnpm 10 hard-aborts on "ignored build scripts" and won't run
# Prisma's engine build non-interactively. npm runs lifecycle scripts by default.
rm -rf backend/node_modules frontend/node_modules
npm --prefix backend  install --legacy-peer-deps --no-audit --no-fund
npm --prefix frontend install --legacy-peer-deps --no-audit --no-fund

( cd backend  && ./node_modules/.bin/prisma generate )                       # query engine + client
( cd frontend && ./node_modules/.bin/tsc -b && VITE_API_URL=/api ./node_modules/.bin/vite build )  # same-origin API
( cd backend  && ./node_modules/.bin/nest build )

# --- database (persistent, outside the app dir) ---
# Stop the running app first so it releases the SQLite file (else: "database is locked").
# pm2 delete returns before the Node process fully exits — wait for the file lock to clear.
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
sleep 3
mkdir -p "$DATA_DIR"
FRESH=0; [ -s "$DATA_DIR/dental.db" ] || FRESH=1
export DATABASE_URL="file:$DATA_DIR/dental.db"
( cd backend && ./node_modules/.bin/prisma migrate deploy )
if [ "$SEED" = "force" ] || { [ "$SEED" = "auto" ] && [ "$FRESH" = "1" ]; }; then
  echo "   seeding demo data…"
  ( cd backend && ./node_modules/.bin/ts-node prisma/seed.ts ) || echo "   (seed skipped/failed — continuing)"
fi

# --- run via pm2 (cwd=backend so it can serve ../frontend/dist) ---
cd "$APP_DIR/backend"
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
HOST=127.0.0.1 PORT="$PORT" DATA_DIR="$DATA_DIR" NODE_ENV=production \
  pm2 start dist/main.js --name "$PM2_NAME" --update-env --time
pm2 save
# survive reboots (no-op if already configured)
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true
echo "   pm2 process '$PM2_NAME' running on 127.0.0.1:$PORT"
REMOTE

# 3) nginx vhost + HTTPS (separate file -> ichat untouched)
echo "==> [3/3] nginx vhost + certbot…"
ssh "$SSH_TARGET" DOMAIN="$DOMAIN" PORT="$PORT" CERTBOT_EMAIL="$CERTBOT_EMAIL" 'bash -s' <<'REMOTE'
set -euo pipefail
CONF="/etc/nginx/sites-available/$DOMAIN"
sudo tee "$CONF" >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 25m;          # x-ray / image uploads
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
sudo ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN"
sudo nginx -t && sudo systemctl reload nginx

# HTTPS (auto-redirects http->https). Needs port 80 open + DNS pointing here.
command -v certbot >/dev/null || sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect \
  || echo "!! certbot failed — site is live on http:// only (check DNS/port 80)"
REMOTE

echo ""
echo "==> DONE.  https://$DOMAIN"
echo "    login: admin / admin123   (change after demo)"
echo "    logs:  ssh $SSH_TARGET 'pm2 logs $PM2_NAME'"
echo "    redeploy later: just run this script again (data is preserved)."
