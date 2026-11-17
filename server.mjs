import { createServer } from "node:http"
import { handler } from "./dist/server/entry.mjs"

createServer((request, response) => {
  if (new URL(request.url ?? "/", "http://localhost").pathname === "/mcp") return handler(request, response)
  response.writeHead(404).end()
}).listen(Number(process.env.REQUESTS_PORT ?? 4322), process.env.HOST ?? "0.0.0.0")
