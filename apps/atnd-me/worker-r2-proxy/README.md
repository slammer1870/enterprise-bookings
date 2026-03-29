# R2 upload proxy (Cloudflare Worker)

Use this when **direct TLS from your server to R2 fails** (EPROTO). Your app uploads to this Worker over HTTPS; the Worker writes to R2 using its binding (no TLS to `r2.cloudflarestorage.com` from your server).

## 1. Create the R2 bucket

In [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create bucket** (e.g. `atnd-media`).

## 2. Set bucket name in Worker

Edit `wrangler.toml` and set `bucket_name` under `[[r2_buckets]]` to your bucket name (e.g. `atnd-media`).

## 3. Deploy the Worker

```bash
cd apps/atnd-me/worker-r2-proxy
pnpm install --ignore-workspace   # installs wrangler here (this folder isn’t a workspace package)
pnpm run deploy
```

Authenticate with Cloudflare when prompted (browser login), or set `CLOUDFLARE_API_TOKEN` (create at [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)). Note the Worker URL (e.g. `https://atnd-me-r2-proxy.<your-subdomain>.workers.dev`).

## 4. Set the secret

Use a long random string (e.g. `openssl rand -hex 32`). You’ll use the same value in your app env.

```bash
pnpm exec wrangler secret put R2_WORKER_SECRET
```

Paste the secret when prompted.

## 5. Configure the app

In your **atnd-me** app (e.g. in Coolify env vars), set:

| Variable | Example | Required |
|----------|---------|----------|
| `R2_WORKER_URL` | `https://atnd-me-r2-proxy.<subdomain>.workers.dev` | Yes (no trailing slash) |
| `R2_WORKER_SECRET` | same value you set in the Worker | Yes |
| `R2_BUCKET_NAME` | `atnd-media` | Yes (must match wrangler.toml) |
| `R2_PUBLIC_URL` | `https://media.yoursite.com` or R2 public URL | Optional (for public file URLs) |

Do **not** set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, or `R2_SECRET_ACCESS_KEY` when using the Worker; the app will use the Worker path instead of the S3 API.

Redeploy the app and try uploading media again.

## Viewing Worker logs

In [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → your Worker (`atnd-me-r2-proxy`) → **Logs** (Real-time or Analytics). You’ll see requests and any errors from the Worker.
