# atnd-me DevOps Roadmap: MVP Fast, Scale Later

Target app: **atnd-me** (Payload CMS, Next.js 15, PostgreSQL, Stripe Connect, Better Auth, multi-tenant).

---

## Cloud hosting options: Vercel vs AWS vs Hetzner + Coolify

You asked about using **AWS** or **Vercel** instead of (or alongside) **Hetzner + Coolify**. Here’s how they fit.

### Option A: Vercel (Next.js–first)

**What it is:** Managed Next.js hosting (and front-end/edge). Deploy via Git; Vercel runs builds and serverless/edge functions.

**Pros for atnd-me:**

- **MVP speed:** Connect repo → auto deploys. No Docker/Coolify to manage. Preview URLs per branch.
- **Next.js native:** Zero config for ISR, edge, and framework features.
- **Global CDN and HTTPS** out of the box.
- **Low ops:** No servers to patch or scale by hand.

**Cons / constraints:**

- **Payload + Postgres:** Payload runs in **serverless functions**. Each request can open a new DB connection. You **must** use **connection pooling** (e.g. Neon pooler, Supabase pooler, or PgBouncer). Without it you’ll hit Postgres connection limits quickly.
- **Cold starts:** Serverless functions can have 100ms–2s cold starts. Acceptable for many UIs; can be annoying for admin or heavy API routes.
- **Execution limits:** Vercel has time and memory limits per function. Long-running jobs (e.g. big reports, bulk ops) should be offloaded to a queue + worker (e.g. Inngest, Trigger.dev, or a small worker on Hetzner/AWS).
- **Cost at scale:** Fine for MVP and early growth; can get expensive at very high traffic (millions of requests). You can still “scale to 100M” by moving heavy or stateful parts off Vercel later (e.g. API on ECS + Vercel for front-end only).

**When to choose Vercel:**

- You want **MVP in users’ hands ASAP** with minimal DevOps.
- You’re okay with Neon (or another pooled Postgres) and possibly moving long-running work to a worker later.
- You prefer to focus on product, not servers.

**Roadmap fit:** Vercel can be your **Phase 1 (MVP)** and stay through Phase 2–3. Phase 4 (100M) might keep Vercel for the Next.js front-end and move Payload API or jobs to AWS/Hetzner if needed.

---

### Option B: AWS (full cloud)

**What it is:** Run atnd-me and all backing services on AWS: ECS/Fargate or App Runner for the app, RDS (or Aurora) for Postgres, S3 for media, CloudFront for CDN, Secrets Manager, etc.

**Pros:**

- **Scale and control:** Auto-scaling, multi-AZ DB, read replicas, global CDN. You can grow to 100M users on one platform.
- **Managed services:** RDS, S3, CloudFront, etc. reduce operational burden vs self-managed on Hetzner.
- **Ecosystem:** Queues (SQS), workers (Lambda/ECS), analytics, compliance tools.

**Cons:**

- **Complexity and cost:** More concepts (VPC, IAM, ECS, RDS). Bill can be higher than Hetzner for the same MVP workload.
- **Ops:** You (or a DevOps person) need to own config, security, and cost. Coolify is simpler for a single app.

**When to choose AWS:**

- You already use AWS or plan to hire DevOps/backend.
- You want one cloud for app + DB + media + queues from day one, with a clear path to 100M.
- Compliance or enterprise requirements point to AWS.

**Roadmap fit:** AWS can replace Hetzner + Coolify in **Phase 1** if you’re willing to invest in setup (e.g. ECS + RDS + S3 + CloudFront). Alternatively, start on Hetzner/Vercel and **migrate to AWS in Phase 3–4** when scale and team justify it.

---

### Option C: Hetzner + Coolify (current)

**What it is:** Self-hosted on Hetzner; Coolify manages Docker deploys, reverse proxy, and (optionally) env.

**Pros:**

- **Cost:** Often cheaper than AWS/Vercel for the same resources.
- **Control and simplicity:** One or a few VPSs; you already know this stack.
- **No vendor lock-in:** Standard Docker/Postgres; easy to move later.

**Cons:**

- **You own reliability:** Backups, monitoring, scaling, and security are on you.
- **Scaling:** Manual or scripted scaling; no built-in “infinite” auto-scale like AWS/Vercel.

**Roadmap fit:** Stays valid for **Phase 1–3**. Phase 4 can stay on Hetzner (multiple nodes + load balancer + managed DB) or migrate to AWS when you need more managed services and global scale.

---

## Recommended hybrid / path

| Goal | Suggested path |
|------|-----------------|
| **MVP ASAP, minimal ops** | **Vercel** for atnd-me + **Neon** (or Supabase) for Postgres. Use Neon pooler; add a worker (e.g. Inngest) later for long jobs. |
| **MVP ASAP, keep current stack** | **Hetzner + Coolify** as in the original roadmap; add staging, health check, backups, then observability. |
| **Enterprise / “we’re going big soon”** | **AWS** from Phase 1 (ECS/Fargate + RDS + S3 + CloudFront), or start on Vercel/Hetzner and **plan migration to AWS** in Phase 3–4. |

**Practical suggestion:**  
Use **Vercel for Phase 1 (MVP)** if you want the fastest path to users and are fine with Neon + connection pooling. Keep the app **stateless and env-driven** so you can later move the Payload API to AWS or Hetzner and keep Vercel for the Next.js front-end only, or move everything to AWS when you outgrow Vercel’s cost or limits.

---

## Phase summary (unchanged, with cloud note)

- **Phase 1 (MVP):** Ship on **Hetzner + Coolify**, **Vercel**, or **AWS**—choose one; keep staging + env-based config.
- **Phase 2:** Backups, logs, errors, uptime (same on any host).
- **Phase 3:** Pooled DB, blob storage, CDN, secrets (Vercel gives you CDN; add R2/S3 for media if needed).
- **Phase 4:** Multi-instance, replicas, queues; consider **AWS** or **Hetzner at scale** if you started on Vercel.

If you tell me which direction you prefer (stay Coolify, try Vercel, or go AWS), the next step can be a concrete “Phase 1 checklist” for that option (e.g. “Vercel + Neon setup for atnd-me” or “AWS ECS + RDS minimal setup”).


---

## Making atnd-me stateless

**Stateless** means: no in-memory or local-disk state that ties a user or request to a specific server. Any replica can serve any request so you can run multiple instances behind a load balancer.

### Already stateless

- **Auth / sessions:** Better Auth and Payload sessions live in **Postgres** (sessions table). Session is looked up by cookie/header; any replica can serve it.
- **App config:** All config (DB, Stripe, Resend, etc.) comes from **env vars** (payload.config, turbo). No local config files that differ per server.
- **Database:** Postgres is external. Use **connection pooling** (Neon pooler or PgBouncer) so multiple replicas do not exhaust connections.

### Changes needed to be fully stateless

1. **Media / uploads (stateful today)**  
   Media collection uses `staticDir: path.resolve(dirname, '../../public/media')` — files are written to the app server disk. A second replica would not see those files.

   **Fix:** Use a Payload **storage adapter** that writes to object storage (S3, Hetzner Spaces, R2, etc.). Configure the adapter in the Media collection and set the bucket/region via env. All replicas then serve the same media URLs. Check Payload 3 docs for `@payloadcms/storage-s3` or the recommended S3-compatible adapter.

2. **Stripe webhook idempotency (stateful today)**  
   `webhookProcessed.ts` uses an **in-memory Set** to avoid processing the same Stripe event twice. With multiple replicas, the same webhook could hit different instances and be processed more than once.

   **Fix:** Store processed event IDs in **Postgres**. Add a table `stripe_webhook_events` with `event_id` (unique) and `processed_at`. In the webhook handler: insert with `ON CONFLICT (event_id) DO NOTHING`; if no row was inserted, skip processing. Replace `hasProcessedStripeConnectEvent` / `markStripeConnectEventProcessed` with DB reads/writes and remove the in-memory Set.

3. **Next.js data cache (optional)**  
   `unstable_cache` and `revalidateTag` are per-instance by default. That is still stateless (no user tied to one server). For shared cache across replicas you would plug in a custom cache store (e.g. Redis); many deployments accept per-instance cache and add Redis later if needed.

### Checklist

| Item | Status | Action |
|------|--------|--------|
| Sessions in DB | OK | No change |
| Config from env | OK | No change |
| DB connection pooling | Check | Use Neon pooler or PgBouncer when running multiple replicas |
| Media on local disk | Stateful | Add S3-compatible storage adapter for Media |
| Stripe webhook idempotency in memory | Stateful | Move to Postgres table |
| No sticky sessions | OK | Do not require load balancer sticky sessions |

After fixing (1) and (2), atnd-me is stateless: you can run N replicas behind a load balancer with no affinity, and any instance can serve any request.
