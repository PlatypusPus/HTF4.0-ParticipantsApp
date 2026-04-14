# Deploying to a VPS (behind host nginx)

The app ships as a single container running nginx that serves the static
React/Vite bundle. The container binds to **`127.0.0.1:8090`** only — your
host's nginx terminates TLS and reverse-proxies to it.

Live at: **https://participant.hacktofuture.in/**

All application state lives in Supabase, so the container is stateless and
can be rebuilt freely.

## 1. Configure `.env`

Copy `.env.example` → `.env` next to `docker-compose.yml`:

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Spotify
VITE_SPOTIFY_CLIENT_ID=...
VITE_SPOTIFY_CLIENT_SECRET=...
```

> ⚠ **Vite vars are build-time.** Any change requires a rebuild: `docker compose build --no-cache && docker compose up -d`.

## 2. Build and run the container

```bash
git clone <your-repo> && cd "Participants APP"
docker compose up -d --build
curl -I http://127.0.0.1:8090   # should return 200
```

## 3. Wire up host nginx

A sample site config lives at `deploy/nginx-site.conf.example`. Install it:

```bash
sudo cp deploy/nginx-site.conf.example \
        /etc/nginx/sites-available/htf4-volunteer.conf

# Already pre-filled with participant.hacktofuture.in — edit only if the
# domain changes again.
sudo nano /etc/nginx/sites-available/htf4-volunteer.conf

sudo ln -s /etc/nginx/sites-available/htf4-volunteer.conf \
           /etc/nginx/sites-enabled/

sudo nginx -t && sudo systemctl reload nginx
```

## 4. Issue a TLS certificate

If you already use certbot:

```bash
sudo certbot --nginx -d participant.hacktofuture.in
```

Certbot reads the server block you just added, issues a Let's Encrypt cert,
and injects the `ssl_certificate` / `ssl_certificate_key` lines automatically.
Reload nginx when it prompts you.

> Web NFC **requires HTTPS with a publicly-trusted certificate** (self-signed
> won't work). Let's Encrypt is free and what certbot uses by default.

## 5. Update Spotify + Supabase for the new origin

1. **Spotify Dashboard → your app → Redirect URIs** — add:
   `https://participant.hacktofuture.in/volunteer/spotify-callback`
2. **Supabase Dashboard → Authentication → URL Configuration**:
   - Site URL: `https://participant.hacktofuture.in`
   - Redirect URLs: `https://participant.hacktofuture.in/**`

## 6. Run the meal/NFC migration once

In Supabase Dashboard → SQL Editor, paste and run `supabase/meals_migration.sql`.

## 7. Updating the app

```bash
git pull
docker compose up -d --build
docker image prune -f
```

Host nginx keeps running; only the container restarts.

## Architecture notes

```
Internet ─► :443 host-nginx (TLS) ─► 127.0.0.1:8090 container-nginx ─► static bundle
```

- Two nginx layers is fine — the inner one handles SPA fallback + asset cache headers + gzip, the outer one handles TLS + HSTS.
- Only port 443 (and 80 for cert renewal) needs to be exposed publicly.
- The container's port binding is `127.0.0.1:8090:80` — even if the host firewall is misconfigured, the container itself refuses external connections.

## Troubleshooting

**502 Bad Gateway from host nginx.**
- Container isn't running: `docker compose ps`
- Wrong port: `curl -I http://127.0.0.1:8090` from the VPS
- SELinux blocking the loopback connection (RHEL-family only): `sudo setsebool -P httpd_can_network_connect on`

**Certbot fails with "connection refused".** Port 80 must be open publicly for HTTP-01 challenges. Check firewall/security group.

**NFC still not working after HTTPS.** Hard-refresh on the phone to clear cache. The Meals tab prints a diagnostic reason code on failure.

## Cheat sheet

```bash
docker compose logs -f web          # tail app logs
docker compose restart web          # restart without rebuild
docker compose down                 # stop + remove container
docker compose build --no-cache     # force clean rebuild
docker exec -it htf4-volunteer sh   # shell into container
sudo tail -f /var/log/nginx/error.log    # host nginx errors
sudo nginx -t && sudo systemctl reload nginx
```
