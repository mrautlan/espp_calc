# Deployment (Docker)

The app is a small Node.js/Express server (`server.js`) that serves the static
front-end in `public/` and proxies a few IBM stock-price / FX requests to Yahoo
Finance and open.er-api.com. All user data (uploaded payslips and statements) is
processed **only in the browser** — nothing is uploaded to or stored on the server.

## What's in this folder

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds a small `node:20-alpine` production image (only `express` — Yahoo Finance is called with Node's built-in https client). |
| `docker-compose.yml` | One-command run; maps a host port to the container. |
| `.dockerignore` | Keeps `node_modules`, dev/test scripts **and your private `payslips/`, `*.pdf`, `*.txt` files** out of the image. |

> ⚠️ **Privacy:** the `.dockerignore` makes sure no statements/payslips end up in the
> image. Still, don't copy your private `payslips/` folder onto a public server at all.

## Prerequisites on the server

- Docker Engine 20.10+ with the Compose v2 plugin (`docker compose version`).
- Outbound internet (the container calls Yahoo Finance + open.er-api.com for live prices).

## Quick start

Copy the project to the server (you only need `Dockerfile`, `docker-compose.yml`,
`.dockerignore`, `package.json`, `package-lock.json`, `server.js`, and `public/`), then:

```bash
docker compose up -d --build
```

The site is now at **http://SERVER_IP:8080**.

Check it:

```bash
docker compose ps
docker compose logs -f
curl -I http://localhost:8080
```

### Change the port

The host port defaults to `8080`. Override it with the `APP_PORT` variable:

```bash
APP_PORT=80 docker compose up -d --build      # serve directly on port 80
```

(or put `APP_PORT=80` in a `.env` file next to `docker-compose.yml`).

## Without Compose (plain Docker)

```bash
docker build -t espp-calc .
docker run -d --name espp-calc --restart unless-stopped -p 8080:3002 espp-calc
```

## Operations

```bash
docker compose logs -f          # tail logs
docker compose restart          # restart
docker compose down             # stop & remove the container
docker compose up -d --build    # update after code changes
```

## Making it public with HTTPS (recommended)

For a real public site you want a domain + HTTPS. The easiest path is to put the
app behind **Caddy**, which obtains and renews Let's Encrypt certificates automatically.

1. Point a DNS `A` record (e.g. `espp.example.com`) at the server's public IP, and
   open ports **80** and **443** in the firewall.
2. Create `Caddyfile` next to the compose file:

   ```
   espp.example.com {
       reverse_proxy espp-calc:3002
   }
   ```

3. Create `docker-compose.https.yml`:

   ```yaml
   services:
     espp-calc:
       build: .
       image: espp-calc:latest
       container_name: espp-calc
       restart: unless-stopped
       expose:
         - "3002"            # internal only; not published to the host

     caddy:
       image: caddy:2-alpine
       container_name: caddy
       restart: unless-stopped
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile:ro
         - caddy_data:/data
         - caddy_config:/config
       depends_on:
         - espp-calc

   volumes:
     caddy_data:
     caddy_config:
   ```

4. Launch it:

   ```bash
   docker compose -f docker-compose.https.yml up -d --build
   ```

   Caddy will fetch a certificate and serve **https://espp.example.com**.

(If you already run nginx/Traefik, just reverse-proxy your domain to the app
container's port `3002` instead.)

## Notes

- The image runs as the non-root `node` user and has a healthcheck (busybox `wget /`).
- If live prices show fallbacks, the server can't reach Yahoo Finance — check the
  container's outbound connectivity.
- No persistent volume is needed: the app keeps no server-side state.
