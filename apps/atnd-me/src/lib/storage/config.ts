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

/** RequestHandler that forwards S3 SDK requests to the R2 proxy Worker (PUT/DELETE/GET). */
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
      const method = request.method ?? 'GET'
      if (request.headers?.['Content-Type']) headers['Content-Type'] = String(request.headers['Content-Type'])
      const res = await fetch(base, {
        method,
        headers,
        body: method === 'PUT' ? (request.body as BodyInit | undefined) : undefined,
      })
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => (resHeaders[k] = v))
      // SDK expects { response: HttpResponse }. For PUT/DELETE 2xx use empty body (Worker returns JSON). For GET return body as Node Readable.
      let body: unknown
      if (method === 'GET' && res.ok && res.body) {
        body = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
      } else if (method === 'PUT' || method === 'DELETE') {
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
      generateFileURL?: (args: { filename: string; prefix?: string }) => string
    }
  }
}

/**
 * Returns R2 storage config when using the R2 proxy Worker (R2_WORKER_URL + R2_WORKER_SECRET + R2_BUCKET_NAME).
 * Use this when direct TLS to R2 fails (e.g. EPROTO on some hosts). Worker uses R2 binding, no TLS from your server.
 */
export function getR2WorkerStorageConfig(): R2StorageConfig | null {
  const workerUrl = process.env.R2_WORKER_URL
  const secret = process.env.R2_WORKER_SECRET
  const bucketName = process.env.R2_BUCKET_NAME
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!workerUrl || !secret || !bucketName) return null

  const collections: R2StorageConfig['collections'] = {
    media: { disableLocalStorage: true },
  }
  if (publicUrl) {
    const baseUrl = publicUrl.replace(/\/$/, '')
    collections.media.generateFileURL = ({ filename, prefix }) =>
      prefix ? `${baseUrl}/${prefix}/${filename}` : `${baseUrl}/${filename}`
  }

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
    collections,
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
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

  const collections: R2StorageConfig['collections'] = {
    media: {
      disableLocalStorage: true,
    },
  }

  if (publicUrl) {
    const baseUrl = publicUrl.replace(/\/$/, '')
    collections.media.generateFileURL = ({ filename, prefix }) => {
      if (prefix) {
        return `${baseUrl}/${prefix}/${filename}`
      }
      return `${baseUrl}/${filename}`
    }
  }

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
    collections,
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
