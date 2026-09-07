/**
 * blob-storage.ts
 * Azure Blob Storage helper for project/application document uploads.
 *
 * Environment variables required (set as Azure App Service Application Settings):
 *   AZURE_STORAGE_CONNECTION_STRING  — full connection string from Azure portal
 *   AZURE_STORAGE_CONTAINER          — container name (default: "lms-documents")
 *
 * Blob naming convention:
 *   projects/{projectId}/{docType}/{timestamp}-{originalFilename}
 *   applications/{applicationId}/{docType}/{timestamp}-{originalFilename}
 *
 * All blobs are stored with public read access disabled.
 * The returned file_url is a direct Azure Blob URL (authenticated via SAS or
 * public container — configured at the container level in Azure portal).
 * For this demo the container is set to "Blob" (public read) so compliance
 * officers can open PDFs directly from the download link.
 */

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || ''
const CONTAINER_NAME    = process.env.AZURE_STORAGE_CONTAINER || 'lms-documents'

// Lazy singleton — only created when a real connection string is present
let _containerClient: ContainerClient | null = null

function getContainerClient(): ContainerClient | null {
  if (!CONNECTION_STRING) return null
  if (_containerClient) return _containerClient
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING)
    _containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME)
    return _containerClient
  } catch (e) {
    console.error('[blob-storage] Failed to create BlobServiceClient:', e)
    return null
  }
}

export function isStorageConfigured(): boolean {
  return !!CONNECTION_STRING
}

/**
 * Upload a file buffer to Azure Blob Storage.
 * Returns the public blob URL, or null if storage is not configured.
 */
export async function uploadBlob(opts: {
  entityType: 'project' | 'application'
  entityId:   string
  docType:    string
  filename:   string
  buffer:     Buffer
  mimeType:   string
}): Promise<string | null> {
  const client = getContainerClient()
  if (!client) {
    console.warn('[blob-storage] No connection string — file not stored in Azure')
    return null
  }

  // Sanitise filename — keep extension, strip path traversal chars
  const safeName = opts.filename.replace(/[^a-zA-Z0-9._\-]/g, '_')
  const blobName = `${opts.entityType}s/${opts.entityId}/${opts.docType}/${Date.now()}-${safeName}`

  try {
    // Ensure container exists (idempotent)
    await client.createIfNotExists({ access: 'blob' })

    const blockBlobClient = client.getBlockBlobClient(blobName)
    await blockBlobClient.uploadData(opts.buffer, {
      blobHTTPHeaders: {
        blobContentType: opts.mimeType || 'application/octet-stream',
        blobContentDisposition: `inline; filename="${safeName}"`,
      },
    })

    console.log(`[blob-storage] Uploaded: ${blobName} (${opts.buffer.length} bytes)`)
    return blockBlobClient.url
  } catch (e) {
    console.error('[blob-storage] Upload failed:', e)
    return null
  }
}

/**
 * Delete a single blob by its full URL.
 * Used during demo reset to purge user-uploaded files.
 */
export async function deleteBlob(blobUrl: string): Promise<boolean> {
  const client = getContainerClient()
  if (!client) return false

  try {
    // Extract blob name from URL: everything after the container name segment
    const url = new URL(blobUrl)
    // path = /{container}/{blobName...}
    const afterContainer = url.pathname.replace(`/${CONTAINER_NAME}/`, '')
    const blockBlobClient = client.getBlockBlobClient(afterContainer)
    await blockBlobClient.deleteIfExists()
    console.log(`[blob-storage] Deleted: ${afterContainer}`)
    return true
  } catch (e) {
    console.error('[blob-storage] Delete failed for', blobUrl, e)
    return false
  }
}

/**
 * Delete all blobs under a given prefix (e.g. "projects/{id}/").
 * Used during demo reset.
 */
export async function deleteBlobsByPrefix(prefix: string): Promise<number> {
  const client = getContainerClient()
  if (!client) return 0

  let count = 0
  try {
    for await (const blob of client.listBlobsFlat({ prefix })) {
      try {
        await client.getBlockBlobClient(blob.name).deleteIfExists()
        count++
      } catch (e) {
        console.error('[blob-storage] Failed to delete blob', blob.name, e)
      }
    }
  } catch (e) {
    console.error('[blob-storage] listBlobsFlat failed for prefix', prefix, e)
  }
  return count
}
