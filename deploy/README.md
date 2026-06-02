# Deploy to VPS (demo)

`deploy.sh` runs **from your Mac**: syncs code → builds on the server → migrates +
seeds the DB → starts under **pm2** → writes an **nginx** vhost → issues **HTTPS** via certbot.
It uses its own port (`4100`), its own pm2 process (`dentist-api`), and its own nginx
file — so the **ichat** app on the same VPS is never touched.

---

## One-time: create the `dentist` user on the VPS

SSH into the VPS **as root** and run this block. It creates `dentist` with
passwordless sudo (so the deploy runs unattended):

```bash
# --- run as root on the VPS ---
adduser --disabled-password --gecos "" dentist
echo 'dentist:CHANGE_ME' | chpasswd          # set your own password here
usermod -aG sudo dentist
echo 'dentist ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/dentist
chmod 440 /etc/sudoers.d/dentist
mkdir -p /home/dentist/.ssh && chmod 700 /home/dentist/.ssh
chown -R dentist:dentist /home/dentist/.ssh
```

Then **from your Mac**, copy your SSH key so the deploy needs no password:

```bash
ssh-copy-id dentist@dentist.devcenter.dev
# (enter the password printed above, once)
```

> NOPASSWD sudo is a convenience tradeoff for a demo box. To lock it down later:
> `sudo rm /etc/sudoers.d/dentist` and the user falls back to password sudo.

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
SSH_TARGET=dentist@1.2.3.4 ./deploy/deploy.sh   # deploy by IP
SEED=force ./deploy/deploy.sh                  # wipe-free reseed of demo data
PORT=4200 ./deploy/deploy.sh                   # change internal port
```

When it finishes: **https://dentist.devcenter.dev** — login `admin` / `admin123`.

---

## After deploy

```bash
ssh dentist@dentist.devcenter.dev 'pm2 logs dentist-api'   # tail logs
ssh dentist@dentist.devcenter.dev 'pm2 restart dentist-api'
```

- **Redeploy / update:** just run `./deploy/deploy.sh` again. The DB + uploads live in
  `/home/dentist/dentist-data` and are **never** overwritten by a redeploy.
- **Data safety:** the app auto-backs-up into `dentist-data/backups`; copy that folder
  off-box for real backups.
