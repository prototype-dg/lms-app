import { defineConfig } from 'vite'
import { execSync } from 'child_process'

// Bake the git short hash into the bundle as a global constant.
// Every deploy produces a unique token — the cache-bust redirect in index.tsx
// uses it to force a fresh fetch on machines with stale disk cache.
const deployVersion = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return Date.now().toString(36) }
})()

export default defineConfig({
  define: {
    __DEPLOY_VERSION__: JSON.stringify(deployVersion),
  },
  build: {
    // Build as an ES module library — Vite will NOT inject a serve() call
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    target: 'node22',
    outDir: 'dist',
    // Copy public assets so serveStatic can find them at runtime
    copyPublicDir: true,
    rollupOptions: {
      // All Node.js built-ins and native addons must be external
      external: [
        'better-sqlite3',
        // Node built-ins (bare and node: protocol)
        'fs', 'path', 'os', 'crypto', 'stream', 'buffer', 'util',
        'http', 'https', 'net', 'tls', 'zlib', 'events', 'url',
        'node:fs', 'node:path', 'node:os', 'node:crypto', 'node:stream',
        'node:buffer', 'node:util', 'node:http', 'node:https', 'node:net',
        'node:tls', 'node:zlib', 'node:events', 'node:url', 'node:process',
        // Hono node server — loaded at runtime by server.js
        '@hono/node-server',
        '@hono/node-server/serve-static',
      ],
    },
  },
})
