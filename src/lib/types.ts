/**
 * Shared binding types for Azure/Node.js environment.
 * Replaces Cloudflare Workers D1Database / Fetcher types.
 */
import type { DB as DBType } from './db-adapter'

export type NodeDB = typeof DBType

export interface NodeBindings {
  DB: NodeDB
  OPENAI_API_KEY: string
  GOOGLE_VISION_API_KEY: string
  DEMO_MODE: string
  VPS_URL: string
}
