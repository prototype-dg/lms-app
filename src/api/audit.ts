import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
const app = new Hono<{ Bindings: NodeBindings }>()


export { app as auditApi }
