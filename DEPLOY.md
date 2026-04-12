# Deploying to a VPS

The stack is two containers:
- **web** — static React/Vite bundle served by nginx (internal only)
- **caddy** — terminates HTTPS with auto-provisioned Let's Encrypt certs, reverse proxies to `web`

All application state lives in Supabase, so the containers are stateless apart from Caddy's cert volume.

## 1. Prerequisites

- **A domain name** pointing at your VPS's public IP (A/AAAA record). Let's Encrypt cannot issue certificates for raw IPs. Free option: `duckdns.org`.
- **Ports 80 and 443** open on the VPS firewall — both are required (80 for the HTTP-01 ACME challenge, 443 for HTTPS).
- Docker + Compose:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # log out/in after this
  ```

## 2. Configure `.env`

Copy `.env.example` → `.env` next to `docker-compose.yml` and fill in:

```env
# Domain + Let's Encrypt contact
DOMAIN=htf4.yourdomain.com
EMAIL=you@yourdomain.com

# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Spotify
VITE_SPOTIFY_CLIENT_ID=...
VITE_SPOTIFY_CLIENT_SECRET=...
```

> ⚠ **Vite vars are build-time.** Changing any `VITE_*` value requires a rebuild: `docker compose build --no-cache && docker compose up -d`.

## 3. Build and run

```bash
git clone <your-repo> && cd "Participants APP"
docker compose up -d --build
docker compose logs -f caddy    # watch Caddy acquire the cert
```

On first run, Caddy solves the HTTP-01 challenge and installs a certificate. You should see a line like `certificate obtained successfully` in the logs within 10–30 seconds.

The app is now live at **`https://<DOMAIN>`**. Plain HTTP requests to port 80 are automatically redirected to HTTPS by Caddy.

## 4. Update Spotify + Supabase for the new origin

1. **Spotify Dashboard → your app → Redirect URIs** — add:
   `https://<DOMAIN>/volunteer/spotify-callback`
2. **Supabase Dashboard → Authentication → URL Configuration**:
   - Site URL: `https://<DOMAIN>`
   - Redirect URLs: `https://<DOMAIN>/**`

## 5. Run the meal/NFC migration once

In Supabase Dashboard → SQL Editor, paste and run the contents of `supabase/meals_migration.sql`.

## 6. Updating the app

```bash
git pull
docker compose up -d --build
docker image prune -f
```

Caddy keeps running throughout — only the `web` container restarts.

## Troubleshooting

**Cert not issuing.** Check `docker compose logs caddy`:
- `no such host` → DNS isn't pointing at the VPS yet. Wait for propagation.
- `connection refused` / `timeout` → port 80 is blocked. Open it in the VPS firewall (`ufw allow 80,443/tcp`) and any cloud-provider security group.
- Testing DNS / cert config without burning rate limits: uncomment the `acme_ca` staging line in `Caddyfile`, then re-comment once it works and run `docker compose restart caddy`.

**NFC still not working after HTTPS.** Hard-refresh the page on your phone (clear cache), then open the Meals tab. The diagnostic card will print a specific reason code if NFC is still blocked.

## Cheat sheet

```bash
docker compose logs -f web          # tail app logs
docker compose logs -f caddy        # tail proxy / TLS logs
docker compose restart web          # restart app without rebuild
docker compose down                 # stop everything
docker compose build --no-cache     # force clean rebuild
docker exec -it htf4-volunteer-web sh    # shell into app container
docker exec -it htf4-volunteer-caddy sh  # shell into caddy
```
