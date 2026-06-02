# Deploy to VPS (demo)

`deploy.sh` runs **from your Mac**: syncs code → builds on the server → migrates +
seeds the DB → starts under **pm2** → writes an **nginx** vhost → issues **HTTPS** via certbot.
It uses its own port (`4100`), its own pm2 process (`dentist-api`), and its own nginx
file — so the **ichat** app on the same VPS is never touched.

---

## One-time: create the `ubuntu` user on the VPS

SSH into the VPS **as root** and run this block. It creates `ubuntu`, gives it
passwordless sudo (so the deploy runs unattended), and prints a strong password:

```bash
# --- run as root on the VPS ---
PW="$(openssl rand -base64 18)"                 # strong random password
adduser --disabled-password --gecos "" ubuntu   # create user (no password prompt)
echo "ubuntu:$PW" | chpasswd                     # set the generated password
usermod -aG sudo ubuntu                          # sudo group
echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu  # unattended sudo
chmod 440 /etc/sudoers.d/ubuntu
mkdir -p /home/ubuntu/.ssh && chmod 700 /home/ubuntu/.ssh
chown -R ubuntu:ubuntu /home/ubuntu/.ssh
echo
echo "================  SAVE THIS  ================"
echo "  ubuntu password:  $PW"
echo "============================================"
```

Then **from your Mac**, copy your SSH key so the deploy needs no password:

```bash
ssh-copy-id ubuntu@dentist.devcenter.dev
# (enter the password printed above, once)
```

> NOPASSWD sudo is a convenience tradeoff for a demo box. To lock it down later:
> `sudo rm /etc/sudoers.d/ubuntu` and the user falls back to password sudo.

Make sure the firewall allows web traffic (certbot needs port 80):

```bash
sudo ufw allow 'Nginx Full' 2>/dev/null || true   # or: sudo ufw allow 80,443/tcp
```

---

## Deploy

```bash
./deploy/deploy.sh
```

Overrides (all optional):

```bash
SSH_TARGET=ubuntu@1.2.3.4 ./deploy/deploy.sh   # deploy by IP
SEED=force ./deploy/deploy.sh                  # wipe-free reseed of demo data
PORT=4200 ./deploy/deploy.sh                   # change internal port
```

When it finishes: **https://dentist.devcenter.dev** — login `admin` / `admin123`.

---

## After deploy

```bash
ssh ubuntu@dentist.devcenter.dev 'pm2 logs dentist-api'   # tail logs
ssh ubuntu@dentist.devcenter.dev 'pm2 restart dentist-api'
```

- **Redeploy / update:** just run `./deploy/deploy.sh` again. The DB + uploads live in
  `/home/ubuntu/dentist-data` and are **never** overwritten by a redeploy.
- **Data safety:** the app auto-backs-up into `dentist-data/backups`; copy that folder
  off-box for real backups.
