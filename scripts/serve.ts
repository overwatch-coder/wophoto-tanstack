import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

if (typeof process.loadEnvFile === 'function') {
  if (fs.existsSync('.env.local')) {
    process.loadEnvFile('.env.local')
  } else if (fs.existsSync('.env')) {
    process.loadEnvFile('.env')
  }
}

import { toNodeHandler } from 'srvx/node'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
}

const clientDir = path.resolve(process.cwd(), 'dist/client')
const serverEntry = await import(path.resolve(process.cwd(), 'dist/server/server.js'))
const appFetchHandler = serverEntry.default?.fetch ?? serverEntry.default

const nodeAppHandler = toNodeHandler(appFetchHandler)
const handleNodeRequest = nodeAppHandler as (
  request: http.IncomingMessage,
  response: http.ServerResponse,
) => void

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const pathname = decodeURIComponent(url.pathname)

  // Check if static file in clientDir exists
  const filePath = path.join(clientDir, pathname)
  if (filePath.startsWith(clientDir) && fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath)
      if (stat.isFile()) {
        const ext = path.extname(filePath).toLowerCase()
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'
        res.setHeader('Content-Type', contentType)
        if (pathname.startsWith('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
        fs.createReadStream(filePath).pipe(res)
        return
      }
    } catch {
      // Continue to handler if file stat fails
    }
  }

  // Fallback to TanStack Start server handler
  handleNodeRequest(req, res)
})

const port = Number(process.env.PORT) || 3000
const host = process.env.HOST || '0.0.0.0'

server.listen(port, host, () => {
  console.log(`> WoPhoto TanStack Start production server listening on http://${host}:${port}`)
})
