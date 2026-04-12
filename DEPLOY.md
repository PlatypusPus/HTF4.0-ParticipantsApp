# Deploying to a VPS

The app is a static React/Vite bundle served by nginx inside a container. All
application state lives in Supabase — the container itself is stateless and
can be rebuilt / scaled freely.

## 1. Prerequisites on the VPS

```bash
# Docker + Compose (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in after this
```

## 2. Supply environment variables

Create a `.env` file next to `docker-compose.yml` (copy from `.env.example`):

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_SPOTIFY_CLIENT_ID=...
VITE_SPOTIFY_CLIENT_SECRET=...
```

> ⚠ **Build-time, not runtime.** Vite inlines `VITE_*` variables into the JS
> bundle during `vite build`. Changing `.env` requires rebuilding the image
> (`docker compose build --no-cache`). Secrets end up in the browser — never
> put anything truly secret here; use Supabase Edge Functions instead.

## 3. Build and run

```bash
git clone <your-repo> && cd "Participants APP"
docker compose up -d --build
```

The app now serves on `http://<vps-ip>:8080`.

## 4. Put HTTPS in front

Expose the container on localhost only and let Caddy handle TLS:

**`docker-compose.yml`** — change `"8080:80"` to `"127.0.0.1:8080:80"`.

**`/etc/caddy/Caddyfile`**:
```caddy
htf4.yourdomain.com {
    reverse_proxy 127.0.0.1:8080
}
```

Caddy auto-provisions a Let's Encrypt certificate on reload:
```bash
sudo systemctl reload caddy
```

## 5. Update Spotify + Supabase after domain change

Once the app is live at `https://htf4.yourdomain.com`:

1. **Spotify Dashboard → your app → Redirect URIs** — add:
   `https://htf4.yourdomain.com/volunteer/spotify-callback`
2. **Supabase Dashboard → Authentication → URL Configuration**:
   - Site URL: `https://htf4.yourdomain.com`
   - Redirect URLs: `https://htf4.yourdomain.com/**`

## 6. Updating

```bash
git pull
docker compose up -d --build
```

Old image layers can be pruned with `docker image prune -f`.

## 7. Running the meal/NFC migration once

First-time only — in Supabase Dashboard → SQL Editor, paste and run the
contents of `supabase/meals_migration.sql`.

## Commands cheat-sheet

```bash
docker compose logs -f web      # tail logs
docker compose restart web      # restart without rebuild
docker compose down             # stop + remove container
docker compose build --no-cache # force a clean rebuild
docker exec -it htf4-volunteer sh   # shell into container
```
