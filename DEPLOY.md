# aMenuVerse — CyberPanel VPS Deployment Guide (Manual SSH)

> First-time deployment on a fresh CyberPanel / OpenLiteSpeed VPS, driven entirely
> from an SSH session. Run commands as **root** (or with `sudo`).
> Replace `menuversebd.com` with your actual domain throughout.

---

## ⚠️ Security Notice — Read First

The helper scripts `scripts/deploy-remote.js`, `scripts/deploy-git.js`, and
`scripts/deploy-env.js` are committed to git and contain **hardcoded production
credentials** (SSH password, MySQL password, and JWT secret). The GitHub remote is
`princeshiamofficial/aMenuVerse` — if that repo is public, those secrets are exposed.

Before or right after deploying, you should:

- **Rotate** the SSH password, MySQL password, and `JWT_SECRET` — assume the committed ones are compromised.
- **Scrub the scripts**: replace the hardcoded values with `process.env.*` reads so no secret is ever committed again. Rotation is mandatory because the old values remain in git history even after you edit the files.
- Keep real secrets only in `.env` on the server — it is already covered by `.gitignore`.

This manual guide deliberately does **not** use those scripts.

---

## Architecture Overview

```text
Internet
   │
   ▼
[DNS]  menuversebd.com + *.menuversebd.com  →  VPS IP
   │
   ▼
[CyberPanel / OpenLiteSpeed :443]  (SSL, HTTPS redirect via .htaccess)
   │
   ▼  reverse proxy
[Node.js / Nitro server :3000]  ←  PM2 (ecosystem.config.cjs)
   │
   ├── MySQL   (CyberPanel-managed, 127.0.0.1:3306)
   └── Redis   (127.0.0.1:6379, optional)
```

### How subdomain routing works

```text
burgercraftlab.menuversebd.com  →  OLS  →  Node :3000
                                              │
                                       getSubdomain() → "burgercraftlab"
                                              │
                                       renders that restaurant's public menu
```

The Node process serves the whole app. OpenLiteSpeed simply proxies every request
(root domain and all subdomains) to `127.0.0.1:3000`.

---

## What You're Deploying

- **Framework**: TanStack Start (React 19 + Vite 8), built to a Nitro Node server.
- **Build output**: `.output/server/index.mjs` (this is what runs in production).
- **Process manager**: PM2, configured by `ecosystem.config.cjs` (app name `amenuverse`, port `3000`).
- **Database**: MySQL. Tables are **auto-created on first boot** by `ensureAllTablesExist()` in `src/lib/mysql.ts` — you only need to create an empty database and a user.
- **Cache/rate-limit**: Redis via `REDIS_URL` — **optional**; the app degrades gracefully if it is absent.

---

## Prerequisites

- A VPS with CyberPanel already installed (OpenLiteSpeed edition).
- SSH root access to the VPS.
- Your domain's DNS managed somewhere you can add `A` and wildcard records (Cloudflare recommended for wildcard SSL).

---

## Step 1 — Connect via SSH

```bash
ssh root@YOUR_VPS_IP
```

---

## Step 2 — Install Node.js 22 LTS, PM2 & Git

Vite 8 requires Node `>= 20.19` or `>= 22.12`; Node 22 LTS is the safe target.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git unzip
node -v          # expect v22.x
npm install -g pm2
```

---

## Step 3 — Create the Website in CyberPanel

Do this in the CyberPanel web UI (`https://YOUR_VPS_IP:8090`):

1. **Websites → Create Website**
   - Domain: `menuversebd.com`
   - Email + package: your choice
   - PHP: any version (it won't be used, but one must be selected)
2. This creates the document root at `/home/menuversebd.com/public_html`.

---

## Step 4 — Get the Code onto the Server

Back in your SSH session:

```bash
cd /home/menuversebd.com/public_html
# Remove the default placeholder files CyberPanel created
rm -f index.html index.php
# Clone into the current directory (note the trailing dot)
git clone https://github.com/princeshiamofficial/aMenuVerse.git .
```

If the repo is private, use an HTTPS token or SSH deploy key when cloning.

---

## Step 5 — Create the MySQL Database & User (CyberPanel)

In CyberPanel UI: **Databases → Create Database**

- Database name: `menu_verse`
- Username: `menu_verse`
- Password: a **strong** password (do not reuse the one committed in the scripts)

CyberPanel prefixes names on some setups — use the exact final names it shows you when
filling in `.env` below.

---

## Step 6 — Configure Environment Variables

Create the production `.env` (it is git-ignored, so it stays on the server only):

```bash
cd /home/menuversebd.com/public_html
nano .env
```

Paste and fill in your real values:

```env
# ImgBB (image uploads / CDN)
VITE_IMGBB_API_KEY=your_imgbb_key

# MySQL — use the CyberPanel DB credentials from Step 5
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=menu_verse
MYSQL_PASSWORD=YOUR_STRONG_DB_PASSWORD
MYSQL_DATABASE=menu_verse

# JWT / auth — generate strong secrets (see below). Both must match.
JWT_SECRET=REPLACE_WITH_STRONG_SECRET
VITE_JWT_SECRET=REPLACE_WITH_STRONG_SECRET

# Redis (optional — omit this line to run without Redis)
REDIS_URL=redis://127.0.0.1:6379

# Bright Data (optional — only for Google Reviews scraping)
# BRIGHTDATA_API_KEY=your_key
# VITE_BRIGHTDATA_API_KEY=your_key
```

Generate a strong secret and paste it into **both** JWT fields:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Note: `VITE_`-prefixed values are baked into the client bundle at **build time**, so set
> `.env` correctly **before** the build in Step 8. Never put a value in a `VITE_` variable
> that must stay secret from the browser.

---

## Step 7 — (Optional) Install Redis

Redis enables distributed rate-limiting and real-time features. Skip this if you left
`REDIS_URL` out of `.env`.

```bash
apt install -y redis-server
systemctl enable --now redis-server
redis-cli ping        # expect: PONG
```

---

## Step 8 — Install Dependencies & Build

The build needs dev dependencies (Vite, Nitro), so use a full `npm ci` — not
`--production`.

```bash
cd /home/menuversebd.com/public_html
npm ci
npm run build         # produces .output/
```

> Low-RAM VPS tip: if `npm run build` is killed (OOM) on a 1 GB box, add swap
> (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`)
> or build locally and upload the `.output/` directory via SFTP.

---

## Step 9 — Initialize the Database

Table creation is automatic — `ensureAllTablesExist()` runs on the first DB connection
when the app boots. You do **not** have to run a schema script.

Optionally, to create the first login and demo tenants, run the seeder:

```bash
node scripts/create-admin.js
```

This inserts five demo restaurants and admin users, all with the password
**`password123`**. Log in, then **immediately change these passwords** (or delete the demo
accounts) before going live.

Other optional helpers (all read `.env`, except `seed.js` which reads `.env.local`):

```bash
node scripts/init-db.js     # create core tables only, no seed data
node scripts/seed.js        # fuller demo data — requires a .env.local file
```

> `scripts/schema.sql` is a **destructive** fresh-install script (it `DROP`s tables).
> Only import it into a brand-new empty database, never one containing real data.

---

## Step 10 — Start the App with PM2

```bash
cd /home/menuversebd.com/public_html
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup           # run the command it prints to enable auto-start on reboot
```

Verify the Node server is up on port 3000:

```bash
pm2 list
pm2 logs amenuverse --lines 50
curl -I http://127.0.0.1:3000/api/health   # expect HTTP/1.1 200
```

> `ecosystem.config.cjs` runs `.output/server/index.mjs` in cluster mode on port `3000`.
> If port 3000 is taken, change `PORT` in that file (and keep Step 11 in sync). If cluster
> mode causes port-bind errors on a tiny VPS, set `instances: 1` and `exec_mode: "fork"`.

---

## Step 11 — OpenLiteSpeed Reverse Proxy

### 11a. Register the Node app as an External App

CyberPanel → **Websites → `menuversebd.com` → Manage → vHost Conf** (or
**OpenLiteSpeed WebAdmin → Virtual Hosts**), add an external app:

```text
Type:            Web Server
Name:            nodejs_app
Address:         127.0.0.1:3000
Max Connections: 100
Initial Request Timeout: 60
```

### 11b. Proxy all traffic to Node

CyberPanel → **Websites → `menuversebd.com` → Rewrite Rules**, add:

```apache
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
```

The repo's `.htaccess` already forces HTTPS, so HTTP requests get 301-redirected to HTTPS
before being proxied. Restart OpenLiteSpeed after saving:

```bash
systemctl restart lsws
```

---

## Step 12 — Wildcard Subdomain

### 12a. DNS records

Add these at your DNS provider:

| Type | Name | Value        |
| ---- | ---- | ------------ |
| A    | `@`  | `YOUR_VPS_IP` |
| A    | `*`  | `YOUR_VPS_IP` |

The `*` record makes `burgercraftlab.menuversebd.com`, `sakurasushibar.menuversebd.com`,
etc. all resolve to the VPS.

### 12b. Child domain in CyberPanel

CyberPanel → **Websites → Create Child Domain** (or **Create Website** as a separate
vHost):

- Domain: `*.menuversebd.com`
- Parent: `menuversebd.com`

Apply the **same** rewrite rule from Step 11b to the wildcard vHost.

---

## Step 13 — Issue SSL

For the root domain, a normal Let's Encrypt cert works:

CyberPanel → **SSL → Manage SSL → Issue SSL** for `menuversebd.com`.

For the **wildcard** (`*.menuversebd.com`), Let's Encrypt requires a **DNS-01 challenge**
(HTTP validation cannot cover wildcards). Cloudflare is the easiest path:

1. Cloudflare → **My Profile → API Tokens → Create Token** → template "Edit zone DNS".
2. CyberPanel → **SSL → Hostname/Wildcard SSL** (or Manage SSL) → choose the DNS/Cloudflare
   method and paste the token.

This issues one certificate valid for both `menuversebd.com` and `*.menuversebd.com`.

---

## Step 14 — Verify End to End

```bash
pm2 list                                   # amenuverse online
curl -I https://menuversebd.com            # 200 / valid TLS
curl -s https://menuversebd.com/api/health # {"status":"healthy",...}
```

In a browser:

- `https://menuversebd.com` → landing page ✅
- `https://burgercraftlab.menuversebd.com` → that restaurant's menu ✅

---

## Updating an Existing Deployment

For future releases, from the project directory:

```bash
cd /home/menuversebd.com/public_html
git pull origin main
npm ci
npm run build
pm2 restart amenuverse --update-env
```

---

## Troubleshooting

| Problem                          | Fix                                                                     |
| -------------------------------- | ----------------------------------------------------------------------- |
| `502 / 503` from the browser     | Node not running — `pm2 list`, `pm2 logs amenuverse`; confirm port 3000 |
| Health check DB `ok:false`       | Wrong `.env` MySQL creds, or DB/user not created in CyberPanel          |
| `curl 127.0.0.1:3000` refused    | App crashed on boot — `pm2 logs amenuverse` (usually a missing env key) |
| Subdomain shows 404 / wrong site | Missing wildcard `A` record or wildcard child vHost / rewrite rule      |
| SSL error on subdomains          | Re-issue **wildcard** SSL via the DNS (Cloudflare) challenge            |
| `.output` missing after clone    | `.output` is git-ignored — run `npm run build`                          |
| Build killed / OOM               | Add swap, or build locally and upload `.output/` (see Step 8)           |
| Port 3000 already in use         | `pm2 delete amenuverse`, change `PORT` in `ecosystem.config.cjs`, restart |
| Redis connection warnings        | Redis is optional — install it (Step 7) or remove `REDIS_URL` from `.env` |

---

## Post-Deploy Security Checklist

- [ ] Rotated SSH, MySQL, and `JWT_SECRET` values that were committed in `scripts/deploy-*.js`.
- [ ] Replaced hardcoded secrets in those scripts with `process.env.*` reads.
- [ ] Changed or removed the demo `password123` admin accounts from `create-admin.js`.
- [ ] `.env` exists only on the server and is git-ignored (it is by default).
- [ ] Firewall allows `80`/`443` only; MySQL (3306), Redis (6379), and Node (3000) stay bound to `127.0.0.1`.
- [ ] `ufw` (or CyberPanel firewall) enabled.
