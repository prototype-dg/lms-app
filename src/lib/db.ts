// Database helper utilities

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}${timestamp}${random}`
}

export function now(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0]
}

export async function logAudit(db: D1Database, {
  userId = 'system',
  userName = 'System',
  userRole = 'system',
  action,
  entityType,
  entityId,
  details = {},
  source = 'manual',
  aiConfidence,
  regulatoryReference,
}: {
  userId?: string
  userName?: string
  userRole?: string
  action: string
  entityType?: string
  entityId?: string
  details?: object
  source?: string
  aiConfidence?: number
  regulatoryReference?: string
}) {
  const id = generateId('al')
  await db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, details, source, ai_confidence, regulatory_reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, userName, userRole, action, entityType || null, entityId || null, JSON.stringify(details), source, aiConfidence || null, regulatoryReference || null, now()).run()
}
