import { defineConfig } from 'vite'

export default defineConfig({
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
