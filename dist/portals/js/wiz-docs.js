/**
 * wiz-docs.js
 * Wizard document state management and Azure Blob upload.
 *
 * Globals exposed:
 *   wizDocs          — map of doc_type → { url, filename, uploadedAt, status, ocrData }
 *   uploadWizDoc()   — upload file to Azure via backend, update wizDocs
 *   getDocStatus()   — 'ok' | 'pending' for a given doc_type
 *   getDocsPayload() — array of { doc_type, url, filename, ... } for submit payload
 *   resetWizDocs()   — clear all doc state (called on wizard reset)
 *
 * Backend route: POST /api/v1/portal/documents/upload
 *   Body: FormData { doc_type, file }
 *   Returns: { url, filename, doc_type }
 */

'use strict';

// Central store: doc_type → document record
const wizDocs = {};

/**
 * Upload a file to Azure Blob via the backend endpoint.
 * Updates wizDocs[docType] with the result.
 * Returns { url, filename } on success, null on failure.
 */
async function uploadWizDoc(docType, file) {
  if (!file || !docType) return null;

  const fd = new FormData();
  fd.append('doc_type', docType);
  fd.append('file', file);

  try {
    const r = await fetch('/api/v1/portal/documents/upload', {
      method: 'POST',
      body: fd
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.warn('[wiz-docs] Upload failed:', err);
      return null;
    }
    const data = await r.json();

    wizDocs[docType] = {
      url:        data.url || null,
      filename:   data.filename || file.name,
      uploadedAt: new Date().toISOString(),
      status:     'ok',
      ocrData:    null
    };

    console.log(`[wiz-docs] Stored ${docType}:`, wizDocs[docType]);
    return wizDocs[docType];
  } catch (e) {
    console.error('[wiz-docs] Network error during upload:', e);
    return null;
  }
}

/**
 * Returns 'ok' if docType has been successfully uploaded, 'pending' otherwise.
 */
function getDocStatus(docType) {
  const rec = wizDocs[docType];
  return rec && rec.status === 'ok' ? 'ok' : 'pending';
}

/**
 * Returns an array of doc records suitable for the submit payload.
 * Only includes successfully uploaded docs.
 */
function getDocsPayload() {
  return Object.entries(wizDocs)
    .filter(([, rec]) => rec && rec.status === 'ok')
    .map(([docType, rec]) => ({
      doc_type:    docType,
      url:         rec.url,
      filename:    rec.filename,
      uploaded_at: rec.uploadedAt,
      ocr_data:    rec.ocrData || null
    }));
}

/**
 * Attach OCR extracted data to an already-uploaded doc (called from runOCR result).
 */
function setWizDocOcr(docType, ocrData) {
  if (wizDocs[docType]) wizDocs[docType].ocrData = ocrData;
}

/**
 * Clear all doc state. Call when starting a fresh wizard session.
 */
function resetWizDocs() {
  Object.keys(wizDocs).forEach(k => delete wizDocs[k]);
}
