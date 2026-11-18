import { createServer } from "node:http"
import { handler } from "./dist/server/entry.mjs"

const REQUEST_PATHS = new Set(["/mcp", "/answers/next"])

createServer((request, response) => {
  if (REQUEST_PATHS.has(new URL(request.url ?? "/", "http://localhost").pathname)) return handler(request, response)
  response.writeHead(404).end()
}).listen(Number(process.env.REQUESTS_PORT ?? 4322), process.env.HOST ?? "0.0.0.0")
