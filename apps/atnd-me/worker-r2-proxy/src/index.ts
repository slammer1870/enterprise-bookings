/**
 * R2 upload proxy Worker. App sends PUT/DELETE/GET here; Worker uses R2 binding.
 * Deploy: cd worker-r2-proxy && pnpm install && pnpm run deploy
 * Secret: npx wrangler secret put R2_WORKER_SECRET
 */

/// <reference types="@cloudflare/workers-types" />

export interface Env {
  R2: R2Bucket
  R2_WORKER_SECRET?: string
}

function auth(req: Request, env: Env): boolean {
  if (!env.R2_WORKER_SECRET) return true
  return req.headers.get('X-R2-Auth') === env.R2_WORKER_SECRET
}

function cors(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    // HEAD is required: Payload storage-s3 getFile() calls headObject before getObject.
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-R2-Auth, X-R2-Key, Content-Type',
  }
}

function inferContentTypeFromKey(key: string): string | null {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'avif') return 'image/avif'
  return null
}

function objectHeaders(
  key: string,
  object: { size: number; httpMetadata?: { contentType?: string }; httpEtag?: string },
): Headers {
  const headers = new Headers(cors())
  const contentType =
    object.httpMetadata?.contentType || inferContentTypeFromKey(key) || 'application/octet-stream'
  headers.set('Content-Type', contentType)
  // Payload 3.84+ rejects media when Content-Length is missing on headObject.
  headers.set('Content-Length', String(object.size))
  if (object.httpEtag) headers.set('ETag', object.httpEtag)
  return headers
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() })
    }
    if (!auth(request, env)) {
      return new Response('Unauthorized', { status: 401, headers: cors() })
    }

    const url = new URL(request.url)
    const key = request.headers.get('X-R2-Key') || url.searchParams.get('key') || ''
    if (!key) {
      return new Response('Missing X-R2-Key or key param', { status: 400, headers: cors() })
    }

    try {
      if (request.method === 'PUT') {
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream'
        await env.R2.put(key, request.body, { httpMetadata: { contentType } })
        return new Response(JSON.stringify({ ok: true, key }), {
          status: 200,
          headers: { ...cors(), 'Content-Type': 'application/json' },
        })
      }
      if (request.method === 'DELETE') {
        await env.R2.delete(key)
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...cors(), 'Content-Type': 'application/json' },
        })
      }
      // headObject (S3 HEAD) — used by @payloadcms/storage-s3 getFile before streaming GET.
      if (request.method === 'HEAD') {
        const object = await env.R2.head(key)
        if (!object) return new Response(null, { status: 404, headers: cors() })
        return new Response(null, { status: 200, headers: objectHeaders(key, object) })
      }
      if (request.method === 'GET') {
        const object = await env.R2.get(key)
        if (!object) return new Response('Not Found', { status: 404, headers: cors() })
        return new Response(object.body, { status: 200, headers: objectHeaders(key, object) })
      }
      return new Response('Method Not Allowed', { status: 405, headers: cors() })
    } catch (e) {
      return new Response(String(e), { status: 500, headers: cors() })
    }
  },
}
