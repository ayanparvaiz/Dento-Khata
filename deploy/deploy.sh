#!/usr/bin/env bash
# One-shot VPS deploy for the dental app (MULTI-TENANT SaaS on PostgreSQL).
# Runs FROM your Mac. Syncs source -> VPS, builds, migrates + seeds the global drug
# catalog, starts via pm2, writes an nginx vhost, and issues HTTPS via certbot.
# Safe alongside other apps (e.g. ichat): own port, own pm2 process, own nginx block,
# own Postgres database.
#
# Usage:
#   deploy/deploy.sh                          # uses defaults below
#   SSH_TARGET=ubuntu@1.2.3.4 deploy/deploy.sh
#   SEED=force deploy/deploy.sh               # re-run the global drug seed
#
# Secrets: pass via env (NEVER commit them). On first deploy the script generates a
# random Postgres password + JWT secret and stores them in $DATA_DIR/app.env on the
# server, then reuses them on every later deploy. Override the super-admin login with
# SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD; set BKASH_RECEIVE_NUMBER for the paywall.
set -euo pipefail

# ===================== config (override via env) =====================
SSH_TARGET="${SSH_TARGET:-dentist@dentist.devcenter.dev}"  # who/where to deploy
DOMAIN="${DOMAIN:-dentist.devcenter.dev}"                  # A-record points here
PORT="${PORT:-4100}"                                       # internal port (NOT ichat's)
APP_DIR="${APP_DIR:-/home/dentist/apps/dentist-app}"       # code lives here (dentist owns it)
DATA_DIR="${DATA_DIR:-/home/dentist/dentist-data}"         # uploads+backups+app.env (survive redeploys)
PM2_NAME="${PM2_NAME:-dentist-api}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-contact@finallyfreeproductions.com}"
SEED="${SEED:-auto}"                                       # auto | force | never
PG_DB="${PG_DB:-dental}"                                   # database name
PG_USER="${PG_USER:-dental}"                               # db role
# Optional overrides forwarded to the server (blank = keep/generate on server):
SUPERADMIN_USERNAME="${SUPERADMIN_USERNAME:-}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-}"
BKASH_RECEIVE_NUMBER="${BKASH_RECEIVE_NUMBER:-}"
SUPPORT_WHATSAPP="${SUPPORT_WHATSAPP:-}"
# Meta tracking (secrets — stored in $DATA_DIR/app.env on the server, never in git)
META_PIXEL_ID="${META_PIXEL_ID:-}"
META_CAPI_TOKEN="${META_CAPI_TOKEN:-}"
# Telegram operator alerts (secrets — stored in $DATA_DIR/app.env on the server)
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
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
  --exclude 'backend/prisma/migrations.sqlite.bak' \
  --exclude 'e2e/shots' --exclude 'e2e/node_modules' \
  "$REPO/" "$SSH_TARGET:$APP_DIR/"

# 2) Build + db + pm2 (runs on the server)
echo "==> [2/3] Building & starting on server…"
ssh "$SSH_TARGET" \
  DOMAIN="$DOMAIN" PORT="$PORT" APP_DIR="$APP_DIR" DATA_DIR="$DATA_DIR" \
  PM2_NAME="$PM2_NAME" SEED="$SEED" PG_DB="$PG_DB" PG_USER="$PG_USER" \
  SUPERADMIN_USERNAME="$SUPERADMIN_USERNAME" SUPERADMIN_PASSWORD="$SUPERADMIN_PASSWORD" \
  BKASH_RECEIVE_NUMBER="$BKASH_RECEIVE_NUMBER" SUPPORT_WHATSAPP="$SUPPORT_WHATSAPP" \
  SUBSCRIPTION_PRICE="${SUBSCRIPTION_PRICE:-990}" \
  META_PIXEL_ID="$META_PIXEL_ID" META_CAPI_TOKEN="$META_CAPI_TOKEN" \
  TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# --- toolchain (idempotent) ---
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2  >/dev/null || sudo npm i -g pm2
command -v nginx >/dev/null || sudo apt-get install -y nginx
command -v rsync >/dev/null || sudo apt-get install -y rsync
# PostgreSQL server + client (pg_dump) for the multi-tenant DB.
command -v psql >/dev/null || sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

mkdir -p "$DATA_DIR"

# --- secrets: generate once, persist in $DATA_DIR/app.env, reuse forever ---
ENVFILE="$DATA_DIR/app.env"
touch "$ENVFILE"; chmod 600 "$ENVFILE"
get_env() { grep -E "^$1=" "$ENVFILE" | tail -1 | cut -d= -f2- || true; }
set_env() { grep -qE "^$1=" "$ENVFILE" && sed -i "s|^$1=.*|$1=$2|" "$ENVFILE" || echo "$1=$2" >> "$ENVFILE"; }

PG_PASS="$(get_env PG_PASS)"
if [ -z "$PG_PASS" ]; then PG_PASS="$(openssl rand -hex 24)"; set_env PG_PASS "$PG_PASS"; fi
JWT_SECRET="$(get_env JWT_SECRET)"
if [ -z "$JWT_SECRET" ]; then JWT_SECRET="$(openssl rand -hex 32)"; set_env JWT_SECRET "$JWT_SECRET"; fi
# super-admin: use override if provided, else keep existing, else generate.
[ -n "${SUPERADMIN_USERNAME:-}" ] && set_env SUPERADMIN_USERNAME "$SUPERADMIN_USERNAME"
[ -z "$(get_env SUPERADMIN_USERNAME)" ] && set_env SUPERADMIN_USERNAME "superadmin"
[ -n "${SUPERADMIN_PASSWORD:-}" ] && set_env SUPERADMIN_PASSWORD "$SUPERADMIN_PASSWORD"
[ -z "$(get_env SUPERADMIN_PASSWORD)" ] && set_env SUPERADMIN_PASSWORD "$(openssl rand -hex 12)"
[ -n "${BKASH_RECEIVE_NUMBER:-}" ] && set_env BKASH_RECEIVE_NUMBER "$BKASH_RECEIVE_NUMBER"
[ -n "${SUPPORT_WHATSAPP:-}" ] && set_env SUPPORT_WHATSAPP "$SUPPORT_WHATSAPP"
[ -n "${META_PIXEL_ID:-}" ] && set_env META_PIXEL_ID "$META_PIXEL_ID"
[ -n "${META_CAPI_TOKEN:-}" ] && set_env META_CAPI_TOKEN "$META_CAPI_TOKEN"
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] && set_env TELEGRAM_BOT_TOKEN "$TELEGRAM_BOT_TOKEN"
[ -n "${TELEGRAM_CHAT_ID:-}" ] && set_env TELEGRAM_CHAT_ID "$TELEGRAM_CHAT_ID"
SUPERADMIN_USERNAME="$(get_env SUPERADMIN_USERNAME)"
SUPERADMIN_PASSWORD="$(get_env SUPERADMIN_PASSWORD)"
BKASH_NUM="$(get_env BKASH_RECEIVE_NUMBER)"; [ -z "$BKASH_NUM" ] && BKASH_NUM="01XXXXXXXXX"
SUPPORT_WA="$(get_env SUPPORT_WHATSAPP)"
META_PID="$(get_env META_PIXEL_ID)"
META_TOK="$(get_env META_CAPI_TOKEN)"
TG_TOKEN="$(get_env TELEGRAM_BOT_TOKEN)"
TG_CHAT="$(get_env TELEGRAM_CHAT_ID)"

# --- provision Postgres role + database (idempotent) ---
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE $PG_USER LOGIN PASSWORD '$PG_PASS';"
sudo -u postgres psql -c "ALTER ROLE $PG_USER PASSWORD '$PG_PASS';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1 \
  || sudo -u postgres createdb -O "$PG_USER" "$PG_DB"
export DATABASE_URL="postgresql://$PG_USER:$PG_PASS@127.0.0.1:5432/$PG_DB"

cd "$APP_DIR"

# --- install + build ---
# Use npm on the server: pnpm 10 hard-aborts on "ignored build scripts" and won't run
# Prisma's engine build non-interactively. npm runs lifecycle scripts by default.
rm -rf backend/node_modules frontend/node_modules
npm --prefix backend  install --legacy-peer-deps --no-audit --no-fund
npm --prefix frontend install --legacy-peer-deps --no-audit --no-fund

( cd backend  && DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/prisma generate )
( cd frontend && ./node_modules/.bin/tsc -b && VITE_API_URL=/api ./node_modules/.bin/vite build )
( cd backend  && ./node_modules/.bin/nest build )

# --- database migrate + global drug seed ---
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
( cd backend && DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/prisma migrate deploy )
if [ "$SEED" = "force" ] || [ "$SEED" = "auto" ]; then
  echo "   seeding global drug catalog…"
  ( cd backend && DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/ts-node prisma/seed.ts ) \
    || echo "   (seed skipped/failed — continuing)"
fi

# --- run via pm2 (cwd=backend so it can serve ../frontend/dist) ---
cd "$APP_DIR/backend"
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
HOST=127.0.0.1 PORT="$PORT" DATA_DIR="$DATA_DIR" NODE_ENV=production \
  DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" \
  SUPERADMIN_USERNAME="$SUPERADMIN_USERNAME" SUPERADMIN_PASSWORD="$SUPERADMIN_PASSWORD" \
  BKASH_RECEIVE_NUMBER="$BKASH_NUM" SUPPORT_WHATSAPP="$SUPPORT_WA" \
  SUBSCRIPTION_PRICE="${SUBSCRIPTION_PRICE:-990}" SUBSCRIPTION_GRACE_DAYS="${SUBSCRIPTION_GRACE_DAYS:-3}" \
  META_PIXEL_ID="$META_PID" META_CAPI_TOKEN="$META_TOK" PUBLIC_URL="https://$DOMAIN" \
  TELEGRAM_BOT_TOKEN="$TG_TOKEN" TELEGRAM_CHAT_ID="$TG_CHAT" \
  pm2 start dist/main.js --name "$PM2_NAME" --update-env --time
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true
echo "   pm2 process '$PM2_NAME' running on 127.0.0.1:$PORT"
echo "   Postgres DB '$PG_DB' ready. Super-admin: $SUPERADMIN_USERNAME (password in $ENVFILE)"
REMOTE

# 3) nginx vhost + HTTPS (separate file -> ichat untouched)
echo "==> [3/3] nginx vhost + certbot…"
ssh "$SSH_TARGET" DOMAIN="$DOMAIN" PORT="$PORT" CERTBOT_EMAIL="$CERTBOT_EMAIL" 'bash -s' <<'REMOTE'
set -euo pipefail
CONF="/etc/nginx/sites-available/$DOMAIN"

if sudo test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
  # Already provisioned: certbot owns the vhost (443 + redirect). Don't rewrite it
  # (that would strip HTTPS and force certbot to reconfigure every deploy). Just reload.
  echo "   HTTPS already set up — leaving nginx/certbot as-is (auto-renews)."
  sudo systemctl reload nginx
else
  # First time: write the http vhost, then let certbot add 443 + http->https redirect.
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
  command -v certbot >/dev/null || sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect \
    || echo "!! certbot failed — site is live on http:// only (check DNS/port 80)"
fi
REMOTE

echo ""
echo "==> DONE.  https://$DOMAIN"
echo "    Clinics self-register at https://$DOMAIN/signup (start on the paywall)."
echo "    Super-admin console: https://$DOMAIN/superadmin"
echo "      (username + password are in $DATA_DIR/app.env on the server)"
echo "    Daily DB backups: pg_dump -> $DATA_DIR/backups/ (in-app, 03:00, keeps 30)."
echo "      Off-box copy destination: TBD — wire an rclone/scp cron once you pick storage."
echo "    logs:  ssh $SSH_TARGET 'pm2 logs $PM2_NAME'"
echo "    redeploy later: just run this script again (data + secrets preserved)."
