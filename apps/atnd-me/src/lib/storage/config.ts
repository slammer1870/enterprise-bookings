/**
 * Cloudflare R2 storage for Media uploads.
 * - Direct: S3-compatible API (getR2StorageConfig) when R2_ACCOUNT_ID + credentials are set.
 * - Via Worker: getR2WorkerStorageConfig when R2_WORKER_URL + R2_WORKER_SECRET + R2_BUCKET_NAME are set
 *   (avoids TLS from server to R2; Worker uses R2 binding).
 *
 * Direct: NodeHttpHandler with custom HTTPS agent (min TLS 1.2). On Hetzner/Coolify use R2_USE_DEFAULT_CLIENT=true.
 */

import http from 'node:http'
import https from 'node:https'
import { Readable } from 'node:stream'

import { NodeHttpHandler } from '@smithy/node-http-handler'

function buildR2RequestHandler(): NodeHttpHandler {
  const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 100,
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.2',
  })
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 })
  return new NodeHttpHandler({ httpsAgent, httpAgent })
}

function inferImageContentType(key: string): string | null {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'avif') return 'image/avif'
  return null
}

function applyInferredContentType(resHeaders: Record<string, string>, key: string): void {
  // Next/Image rejects `application/octet-stream`. Prefer a real image MIME from the key.
  const got = (resHeaders['content-type'] ?? '').toLowerCase()
  if (!got || got.includes('application/octet-stream')) {
    const inferred = inferImageContentType(key)
    if (inferred) resHeaders['content-type'] = inferred
  }
}

/** RequestHandler that forwards S3 SDK requests to the R2 proxy Worker (PUT/DELETE/GET/HEAD). */
function buildR2WorkerRequestHandler(
  workerUrl: string,
  secret: string,
  bucket: string,
): {
  handle: (request: { method?: string; path?: string; headers?: Record<string, unknown>; body?: unknown }) => Promise<{
    response: { statusCode: number; headers: Record<string, string>; body?: unknown }
  }>
} {
  const base = workerUrl.replace(/\/$/, '')
  return {
    async handle(request) {
      // S3 path-style: /bucket/key or /bucket/prefix/key
      const pathKey = request.path?.replace(/^\/+/, '') ?? ''
      const key = pathKey.startsWith(bucket + '/') ? pathKey.slice(bucket.length + 1) : pathKey
      const authHeader = { 'X-R2-Auth': secret, 'X-R2-Key': key }
      const headers: Record<string, string> = { ...authHeader }
      const method = (request.method ?? 'GET').toUpperCase()
      // Forward content-type case-insensitively so R2 stores correct metadata.
      const ct =
        (request.headers?.['content-type'] ?? request.headers?.['Content-Type'] ?? request.headers?.['CONTENT-TYPE']) as
          | string
          | undefined
      if (ct) headers['Content-Type'] = String(ct)

      // Payload storage-s3 getFile() always headObject()s first. Older Workers only
      // allowed GET/PUT/DELETE and returned 405 for HEAD → /api/media/file 500.
      let res = await fetch(base, {
        method,
        headers,
        body: method === 'PUT' ? (request.body as BodyInit | undefined) : undefined,
      })
      if (method === 'HEAD' && res.status === 405) {
        // Compat: derive Content-Length from a GET if Worker is not yet redeployed.
        res = await fetch(base, { method: 'GET', headers: authHeader })
        const resHeaders: Record<string, string> = {}
        res.headers.forEach((v, k) => {
          resHeaders[k] = v
        })
        applyInferredContentType(resHeaders, key)
        if (res.ok && !resHeaders['content-length']) {
          const buf = Buffer.from(await res.arrayBuffer())
          resHeaders['content-length'] = String(buf.length)
        } else {
          // Drain body so the socket can close; HEAD response must not include it.
          await res.arrayBuffer().catch(() => undefined)
        }
        return {
          response: {
            statusCode: res.status,
            headers: resHeaders,
            body: undefined,
          },
        }
      }

      const resHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => {
        resHeaders[k] = v
      })
      if ((method === 'GET' || method === 'HEAD') && res.ok) {
        applyInferredContentType(resHeaders, key)
      }

      // SDK expects { response: HttpResponse }. PUT/DELETE/HEAD: no stream body.
      // GET: Node Readable with .pipe + .destroy (required by storage-s3 getFile).
      let body: unknown
      if (method === 'GET' && res.ok && res.body) {
        const webStream = res.body as unknown as { getReader?: unknown }
        if (typeof webStream?.getReader === 'function') {
          body = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
        } else {
          body = undefined
        }
      } else if (method === 'PUT' || method === 'DELETE' || method === 'HEAD') {
        body = res.ok ? undefined : (res.body ?? undefined)
      } else {
        body = res.body ?? undefined
      }
      return {
        response: {
          statusCode: res.status,
          headers: resHeaders,
          body,
        },
      }
    },
  }
}

export interface R2StorageConfig {
  enabled: true
  bucket: string
  config: {
    endpoint: string
    region: 'auto'
    forcePathStyle: true
    credentials: {
      accessKeyId: string
      secretAccessKey: string
    }
    requestHandler?:
      | NodeHttpHandler
      | {
          handle: (req: {
            method?: string
            path?: string
            headers?: Record<string, unknown>
            body?: unknown
          }) => Promise<{
            response: { statusCode: number; headers: Record<string, string>; body?: unknown }
          }>
        }
    maxAttempts?: number
  }
  collections: {
    media: {
      disableLocalStorage: true
      /** When set, Payload does not gate CDN URLs via /api/media/file access control. */
      disablePayloadAccessControl?: true
      generateFileURL?: (args: { filename: string; prefix?: string }) => string
    }
  }
}

/**
 * Optional public CDN base. Only used when R2_PUBLIC_DIRECT=true — otherwise media
 * stays on `/api/media/file/...` and Payload access control (tenant / isPublic) applies.
 */
function getR2PublicBaseUrl(): string | null {
  const raw = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

function buildMediaCollectionConfig(publicBaseUrl: string | null): R2StorageConfig['collections'] {
  const media: R2StorageConfig['collections']['media'] = {
    disableLocalStorage: true,
  }

  // Opt-in only: direct public CDN URLs skip Payload ACL. Default is private bucket +
  // Worker uploads, with reads gated by tenantScopedMediaRead / isPublic.
  const usePublicDirect =
    process.env.R2_PUBLIC_DIRECT === 'true' || process.env.R2_PUBLIC_DIRECT === '1'

  if (usePublicDirect && publicBaseUrl) {
    media.disablePayloadAccessControl = true
    media.generateFileURL = ({ filename, prefix }) =>
      prefix ? `${publicBaseUrl}/${prefix}/${filename}` : `${publicBaseUrl}/${filename}`
  } else if (usePublicDirect && !publicBaseUrl && process.env.NODE_ENV === 'production') {
    console.error(
      '[r2-storage] R2_PUBLIC_DIRECT is set but R2_PUBLIC_URL is missing. ' +
        'Direct CDN URLs cannot be generated; media will keep using /api/media/file/...',
    )
  }

  return { media }
}

/**
 * Returns R2 storage config when using the R2 proxy Worker (R2_WORKER_URL + R2_WORKER_SECRET + R2_BUCKET_NAME).
 * Use this when direct TLS to R2 fails (e.g. EPROTO on some hosts). Worker uses R2 binding, no TLS from your server.
 */
export function getR2WorkerStorageConfig(): R2StorageConfig | null {
  const workerUrl = process.env.R2_WORKER_URL
  const secret = process.env.R2_WORKER_SECRET
  const bucketName = process.env.R2_BUCKET_NAME

  if (!workerUrl || !secret || !bucketName) return null

  return {
    enabled: true,
    bucket: bucketName,
    config: {
      endpoint: workerUrl.replace(/\/$/, ''),
      region: 'auto',
      forcePathStyle: true,
      credentials: { accessKeyId: 'worker', secretAccessKey: 'worker' },
      requestHandler: buildR2WorkerRequestHandler(workerUrl, secret, bucketName),
      maxAttempts: 3,
    },
    collections: buildMediaCollectionConfig(getR2PublicBaseUrl()),
  }
}

/**
 * Returns R2/S3 storage plugin config when R2 env vars are set (direct S3 API); otherwise null.
 * Prefer Worker config when R2_WORKER_URL is set.
 */
export function getR2StorageConfig(): R2StorageConfig | null {
  if (getR2WorkerStorageConfig()) return null

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

  const useDefaultClient = process.env.R2_USE_DEFAULT_CLIENT === 'true'
  const config: R2StorageConfig['config'] = {
    endpoint,
    region: 'auto',
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    maxAttempts: 3,
  }
  if (!useDefaultClient) {
    config.requestHandler = buildR2RequestHandler()
  }

  return {
    enabled: true,
    bucket: bucketName,
    config,
    collections: buildMediaCollectionConfig(getR2PublicBaseUrl()),
  }
}

/**
 * Returns the active R2 config: Worker if R2_WORKER_URL is set, else direct S3.
 */
export function getActiveR2Config(): R2StorageConfig | null {
  return getR2WorkerStorageConfig() ?? getR2StorageConfig()
}

/**
 * Whether cloud (R2/S3) storage is configured for Media.
 */
export function isR2StorageEnabled(): boolean {
  return getActiveR2Config() !== null
}
