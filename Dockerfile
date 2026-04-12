# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the Vite/React bundle
# Vite bakes VITE_* vars into the bundle at BUILD time, so they are passed as
# build args. Supply them via `docker build --build-arg ...` or docker-compose.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time vars (exposed to `vite build` via ENV)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SPOTIFY_CLIENT_ID
ARG VITE_SPOTIFY_CLIENT_SECRET

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SPOTIFY_CLIENT_ID=$VITE_SPOTIFY_CLIENT_ID \
    VITE_SPOTIFY_CLIENT_SECRET=$VITE_SPOTIFY_CLIENT_SECRET

# Install deps (cached layer when lockfile/package.json unchanged)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Build
COPY . .
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Serve the static bundle with nginx
# ──────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# SPA fallback + gzip + immutable asset caching
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled bundle
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Basic healthcheck — nginx responds to HEAD /
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
