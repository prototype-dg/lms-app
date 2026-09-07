# Azure Deployment Guide — Sohar LMS Portal

Full deployment guide for a **Hono + Node.js + SQLite + Azure Blob Storage** app
deployed to **Azure App Service** via **GitHub Actions**.

---

## Architecture Overview

```
GitHub (main branch)
        │
        ▼  push triggers
GitHub Actions CI/CD
        │
        ├─ npm ci + npm run build (Vite → dist/)
        ├─ npm ci --omit=dev      (production deps only)
        ├─ zip everything         (deploy.zip ~50–80 MB)
        │
        ▼  az webapp deploy
Azure App Service (Linux, Node 22)
        │
        ├─ server.js              (entry: @hono/node-server)
        ├─ dist/index.js          (Vite-bundled Hono app)
        ├─ migrations/*.sql       (auto-applied on startup)
        └─ /home/data/app.db      (SQLite — persists in /home/)

Azure Blob Storage
        └─ container: lms-documents   (private, SAS-proxied)
```

**Key design decisions:**
- **SQLite via `better-sqlite3`** — no external database server needed; the file lives on Azure App Service's persistent `/home/` volume (survives restarts, lost on redeploy unless you pin to a mount)
- **Azure Blob Storage** (private) — documents uploaded from the app; downloaded via a server-side SAS token proxy so the storage key never reaches the browser
- **No Cloudflare Workers at runtime** — `wrangler.jsonc` exists only for local dev history; the production stack is pure Node.js on App Service

---

## Part 1 — Azure Resource Setup (one-time, done in Azure Portal or CLI)

### 1.1 Resource Group

```bash
az group create \
  --name MyApp-RG \
  --location eastus
```

### 1.2 App Service Plan (Linux, B1 is enough for a demo)

```bash
az appservice plan create \
  --name MyApp-Plan \
  --resource-group MyApp-RG \
  --is-linux \
  --sku B1
```

### 1.3 Web App (Node 22 LTS)

```bash
az webapp create \
  --name app-my-portal \
  --resource-group MyApp-RG \
  --plan MyApp-Plan \
  --runtime "NODE:22-lts"
```

### 1.4 App Service Application Settings

These become `process.env.*` inside Node.js:

```bash
az webapp config appsettings set \
  --name app-my-portal \
  --resource-group MyApp-RG \
  --settings \
    NODE_ENV="production" \
    DB_PATH="/home/data/app.db" \
    PORT="8080" \
    AZURE_STORAGE_CONNECTION_STRING="<your-connection-string>" \
    AZURE_STORAGE_CONTAINER="lms-documents"
```

> **Why `/home/data/app.db`?**  
> Azure App Service's `/home/` directory is backed by Azure Files and persists across instance restarts and deployments. Everything outside `/home/` is ephemeral (wiped on restart). Put your SQLite file there.

### 1.5 Startup command

Tell App Service how to start the app:

```bash
az webapp config set \
  --name app-my-portal \
  --resource-group MyApp-RG \
  --startup-file "node server.js"
```

### 1.6 Custom domain (optional)

If you have a domain (e.g. via Andersen):

```bash
az webapp config hostname add \
  --webapp-name app-my-portal \
  --resource-group MyApp-RG \
  --hostname lms.yourdomain.com
```

Then add a CNAME `lms → app-my-portal.azurewebsites.net` in your DNS provider.

---

## Part 2 — Azure Blob Storage Setup (one-time)

### 2.1 Create a Storage Account

```bash
az storage account create \
  --name myappblobstorage \
  --resource-group MyApp-RG \
  --location eastus \
  --sku Standard_LRS \
  --allow-blob-public-access false
```

> **`--allow-blob-public-access false`** is critical — this disables public URLs for all blobs. Documents are private and served only via the backend SAS proxy.

### 2.2 Create the container

```bash
az storage container create \
  --name lms-documents \
  --account-name myappblobstorage
```

Do **not** pass `--public-access blob` — the account-level flag blocks it and it throws `PublicAccessNotPermitted`.

### 2.3 Get the connection string

```bash
az storage account show-connection-string \
  --name myappblobstorage \
  --resource-group MyApp-RG \
  --query connectionString \
  --output tsv
```

Copy the output — it looks like:
```
DefaultEndpointsProtocol=https;AccountName=myappblobstorage;AccountKey=XXXX==;EndpointSuffix=core.windows.net
```

This goes into the `AZURE_STORAGE_CONNECTION_STRING` app setting and the GitHub secret.

---

## Part 3 — GitHub Repository Secrets

Go to **GitHub → repo → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `AZURE_CREDENTIALS` | JSON service principal (see below) |
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string from step 2.3 |
| `AZURE_STORAGE_CONTAINER` | `lms-documents` |

### 3.1 Create the service principal for GitHub Actions

```bash
az ad sp create-for-rbac \
  --name "github-actions-myapp" \
  --role contributor \
  --scopes /subscriptions/<SUB_ID>/resourceGroups/MyApp-RG \
  --sdk-auth
```

The output is JSON — paste the **entire JSON block** as the value of `AZURE_CREDENTIALS`:

```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  ...
}
```

---

## Part 4 — GitHub Actions Workflow

File: `.github/workflows/azure-deploy.yml`

```yaml
name: Deploy to Azure App Service

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      # Install ALL deps (including devDeps like vite, typescript)
      - name: Install all dependencies
        run: npm ci

      # Build Vite → produces dist/index.js
      - name: Build frontend
        run: npm run build

      # Strip devDeps — zip only ships production deps
      - name: Install production dependencies only
        run: npm ci --omit=dev

      # Sanity check — fail fast if key files are missing
      - name: Verify key files
        run: |
          ls -lh server.js dist/index.js
          ls -lh node_modules/@hono/node-server/dist/index.mjs
          ls -lh node_modules/better-sqlite3/prebuilds/linux-x64.node

      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      # Push secrets as App Service environment variables
      - name: Configure App Service settings
        run: |
          az webapp config appsettings set \
            --name app-my-portal \
            --resource-group MyApp-RG \
            --settings \
              AZURE_STORAGE_CONNECTION_STRING="${{ secrets.AZURE_STORAGE_CONNECTION_STRING }}" \
              AZURE_STORAGE_CONTAINER="${{ secrets.AZURE_STORAGE_CONTAINER || 'lms-documents' }}"

      # Zip everything except secrets, source, and local dev artifacts
      - name: Create deployment zip
        run: |
          zip -r deploy.zip . \
            --exclude "*.git*" \
            --exclude "*.zip" \
            --exclude ".env*" \
            --exclude "data/*" \
            --exclude ".wrangler/*" \
            --exclude "src/*" \
            --exclude "vite.config*" \
            --exclude "tsconfig*" \
            --exclude "wrangler*" \
            --exclude "ecosystem*"
          echo "Zip size: $(du -sh deploy.zip)"

      # Deploy zip — App Service extracts it, runs startup command
      - name: Deploy to Azure
        run: |
          az webapp deploy \
            --name app-my-portal \
            --resource-group MyApp-RG \
            --src-path deploy.zip \
            --type zip
          echo "✅ Deployment completed"

      - name: Restart app
        run: |
          az webapp restart \
            --name app-my-portal \
            --resource-group MyApp-RG

      # Poll until the app responds 200 (up to 10 minutes)
      - name: Wait for app to come online
        run: |
          for i in $(seq 1 40); do
            CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 15 \
              https://app-my-portal.azurewebsites.net/ 2>/dev/null || echo "000")
            echo "$(date -u '+%H:%M:%S') Attempt $i/40: HTTP $CODE"
            if [ "$CODE" = "200" ]; then
              echo "✅ App is live!"
              exit 0
            fi
            sleep 15
          done
          echo "⚠️ App did not return 200 within 10 minutes — check Kudu logs"
          exit 1
```

---

## Part 5 — Application Code Requirements

### 5.1 server.js (entry point — NOT bundled by Vite)

```js
// server.js
import { serve } from '@hono/node-server'
import app from './dist/index.js'

const port = Number(process.env.PORT) || 8080
console.log(`🚀 Starting on port ${port}`)

serve({ fetch: app.fetch, port })
```

> Azure App Service injects `process.env.PORT` automatically. Reading it at runtime (in `server.js`, not in the Vite bundle) is essential — if you bake the port into `dist/index.js` at build time it will be wrong.

### 5.2 package.json scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "build": "vite build",
    "dev": "NODE_ENV=development DB_PATH=./data/app.db node server.js"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### 5.3 Database path

```ts
// src/lib/db-adapter.ts
const dbPath = process.env.DB_PATH || './data/app.db'
```

In production: `DB_PATH=/home/data/app.db` (set via App Settings).  
In local dev: falls back to `./data/app.db`.

### 5.4 Auto-migrations on startup

The `db-adapter.ts` runs all migrations automatically when the process starts:

```ts
const MIGRATION_FILES = [
  './migrations/0001_initial.sql',
  './migrations/0002_seed.sql',
  // ... add new files here in order
  './migrations/0011_portal_auth.sql',
]
// Tracked via schema_migrations table — each file runs exactly once
runMigrations()
```

**Adding a new migration:** create `migrations/00NN_description.sql` and append its path to `MIGRATION_FILES`. The next deploy auto-applies it.

### 5.5 Blob Storage — private with SAS proxy

Blobs are private (`allowBlobPublicAccess=false`). The browser never gets a direct URL with credentials. Instead:

1. Frontend calls `GET /api/v1/documents/serve?url=<blobUrl>&filename=<name>`
2. Backend generates a 15-minute SAS token using **HMAC-SHA256 over the connection string's `AccountKey`** (pure Node `crypto` — no Azure SDK at request time)
3. Backend fetches the blob server-side and streams it to the browser

The SAS string-to-sign format (version `2020-08-04`) — field order matters exactly:

```
signedPermissions   \n   (e.g. "r")
signedStart         \n   (ISO 8601 UTC, 1 min in the past)
signedExpiry        \n   (ISO 8601 UTC, 15 min in the future)
canonicalizedResource\n  ("/blob/{accountName}/{container}/{blobName}")
signedIdentifier    \n   (empty string)
signedIP            \n   (empty string)
signedProtocol      \n   (empty string)
signedVersion       \n   ("2020-08-04")
signedResource      \n   ("b" for blob)
signedSnapshotTime  \n   (empty string)
rscc                \n   (empty — Cache-Control override)
rscd                \n   (empty — Content-Disposition override)
rsce                \n   (empty — Content-Encoding override)
rscl                \n   (empty — Content-Language override)
rsct                     (empty — Content-Type override, NO trailing \n)
```

```ts
const sig = createHmac('sha256', Buffer.from(accountKey, 'base64'))
  .update(strToSign, 'utf8')
  .digest('base64')
```

---

## Part 6 — Environment Variables Reference

| Variable | Where set | Purpose |
|---|---|---|
| `PORT` | Azure (auto-injected) | HTTP port App Service binds to |
| `NODE_ENV` | App Settings | `production` disables demo helpers |
| `DB_PATH` | App Settings | `/home/data/app.db` — persists across restarts |
| `AZURE_STORAGE_CONNECTION_STRING` | GitHub Secret → App Settings | Blob upload/download/SAS generation |
| `AZURE_STORAGE_CONTAINER` | GitHub Secret → App Settings | Container name (default: `lms-documents`) |
| `OPENAI_API_KEY` | App Settings (if used) | AI draft/extraction features |
| `GOOGLE_VISION_API_KEY` | App Settings (if used) | Document OCR |

---

## Part 7 — Persistent Storage Gotcha

SQLite on Azure App Service:

| Path | Persists? | Notes |
|---|---|---|
| `/home/data/app.db` | ✅ Yes | Backed by Azure Files; survives restarts |
| `./data/app.db` (relative) | ❌ No | In the app package dir — wiped on every deploy |
| `/tmp/app.db` | ❌ No | Ephemeral instance storage |

**Always use an absolute path under `/home/` for SQLite in production.**

If you need the database to survive redeploys with existing data intact, do NOT drop and recreate tables in migrations — use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS`. The `schema_migrations` tracking table ensures each migration runs exactly once.

---

## Part 8 — Viewing Logs

### Via Azure CLI
```bash
az webapp log tail \
  --name app-my-portal \
  --resource-group MyApp-RG
```

### Via Kudu console (browser)
```
https://app-my-portal.scm.azurewebsites.net/DebugConsole
```

Navigate to `/home/LogFiles/` for application logs, or run commands directly in the console to inspect `/home/data/app.db`.

---

## Part 9 — First Deploy Checklist

```
□ Resource group created
□ App Service Plan created (Linux, B1+)
□ Web App created (Node 22 LTS)
□ Startup command set: node server.js
□ DB_PATH set to /home/data/app.db
□ Storage account created with --allow-blob-public-access false
□ Storage container created (lms-documents)
□ AZURE_STORAGE_CONNECTION_STRING set in App Settings
□ AZURE_CREDENTIALS secret added to GitHub
□ AZURE_STORAGE_CONNECTION_STRING secret added to GitHub
□ AZURE_STORAGE_CONTAINER secret added to GitHub
□ server.js reads PORT from process.env at runtime (not baked into bundle)
□ All migration files listed in MIGRATION_FILES array in db-adapter.ts
□ .github/workflows/azure-deploy.yml committed to main branch
□ Push to main → watch Actions tab → app returns HTTP 200
```

---

## Part 10 — Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `ENOENT: no such file or directory, open './migrations/...'` | CWD is not project root | Ensure `az webapp config set --startup-file "node server.js"` and zip includes `migrations/` |
| `PublicAccessNotPermitted` on blob upload | Passing `{ access: 'blob' }` to `createIfNotExists()` | Remove the access param — container inherits account-level private setting |
| `AuthenticationFailed` on blob download (403) | Wrong SAS string-to-sign field order | See Part 5.5 — field order is strict; 15 fields, no trailing `\n` on last |
| `Cannot find module './dist/index.js'` | Build step didn't run or zip excludes `dist/` | Check workflow — `npm run build` must run before `npm ci --omit=dev`; ensure `dist/` is not in `.gitignore` |
| `better-sqlite3` native module error | Architecture mismatch (built on macOS, runs on Linux) | Use GitHub Actions (`ubuntu-latest`) to build — never zip from a Mac/Windows machine |
| App shows old content after deploy | Browser cache or App Service slot swap | The app sends `Clear-Site-Data: "cache"` on HTML requests; hard-refresh or wait for cache TTL |
| SQLite DB is empty after redeploy | DB_PATH points outside `/home/` | Set `DB_PATH=/home/data/app.db` in App Settings |
