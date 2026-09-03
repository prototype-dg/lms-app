// server.js — NOT bundled by Vite. Deployed as-is alongside dist/index.js.
// This is the real entry point for Azure App Service (node server.js).
// It reads process.env.PORT at true runtime, so Azure's injected PORT works.
import { serve } from '@hono/node-server'
import app from './dist/index.js'

const port = Number(process.env.PORT) || 8080

console.log(`🚀 LMS Portal starting on port ${port}`)
console.log(`📁 DB path: ${process.env.DB_PATH || '/home/data/app.db'}`)
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)

serve({
  fetch: app.fetch,
  port,
})
