/**
 * Cloudflare R2 storage for Media uploads via the S3-compatible API.
 * Uses @payloadcms/storage-s3 with R2 endpoint (Payload’s R2 adapter is for
 * Cloudflare Workers only; for Next.js/Node we use S3 adapter per docs).
 * When all required env vars are set, returns config for the plugin; when any
 * are missing, returns null and the app uses local staticDir for Media (dev/test).
 */

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
  }
  collections: {
    media: {
      disableLocalStorage: true
      generateFileURL?: (args: { filename: string; prefix?: string }) => string
    }
  }
}

/**
 * Returns R2/S3 storage plugin config when R2 env vars are set; otherwise null.
 * Used to conditionally enable cloud storage for the Media collection.
 */
export function getR2StorageConfig(): R2StorageConfig | null {
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

  return {
    enabled: true,
    bucket: bucketName,
    config: {
      endpoint,
      region: 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    },
    collections,
  }
}

/**
 * Whether cloud (R2/S3) storage is configured for Media.
 * Use this when you need a boolean without the full config.
 */
export function isR2StorageEnabled(): boolean {
  return getR2StorageConfig() !== null
}
