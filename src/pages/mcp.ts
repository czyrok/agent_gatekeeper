import type { APIRoute } from "astro"
import { env } from "@/lib/env"
import { findPodLabelsByIp } from "@/lib/kubernetes"
import { callTool, TOOLS } from "@/lib/mcp-tools"

type JsonRpcId = string | number | null

type JsonRpcMessage = {
  id?: JsonRpcId
  method?: string
  params?: { protocolVersion?: string; name?: string; arguments?: Record<string, unknown> }
}

function reply(id: JsonRpcId, outcome: { result: unknown } | { error: { code: number; message: string } }) {
  return Response.json({ jsonrpc: "2.0", id, ...outcome })
}

async function resultFor(message: JsonRpcMessage, workspace: string): Promise<unknown> {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "agent-gatekeeper", version: "1.0.0" },
      }
    case "ping":
      return {}
    case "tools/list":
      return { tools: TOOLS }
    case "tools/call": {
      const { text, isError } = await callTool(message.params?.name ?? "", message.params?.arguments ?? {}, workspace)
      return { content: [{ type: "text", text }], isError }
    }
    default:
      return undefined
  }
}

export const GET: APIRoute = () => new Response(null, { status: 405, headers: { Allow: "POST" } })

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (request.headers.has("x-forwarded-for")) {
    return Response.json({ error: "MCP is served to workspaces only" }, { status: 403 })
  }
  const ip = clientAddress.replace(/^::ffff:/, "")
  const labels = await findPodLabelsByIp(env("WORKSPACES_NAMESPACE"), ip).catch(() => undefined)
  if (!labels?.["coder.workspace_name"]) {
    console.warn(`mcp: no workspace pod has IP ${ip}`)
    return Response.json({ error: "Not a workspace", ip }, { status: 403 })
  }
  const workspace = `${labels["coder.workspace_owner"]}/${labels["coder.workspace_name"]}`

  let message: JsonRpcMessage
  try {
    message = await request.json()
  } catch {
    return reply(null, { error: { code: -32700, message: "Parse error" } })
  }
  if (typeof message !== "object" || message === null) {
    return reply(null, { error: { code: -32600, message: "Invalid Request" } })
  }
  if (message.id === undefined) return new Response(null, { status: 202 })

  try {
    const result = await resultFor(message, workspace)
    if (result === undefined) return reply(message.id, { error: { code: -32601, message: "Method not found" } })
    return reply(message.id, { result })
  } catch (error) {
    return reply(message.id, { error: { code: -32603, message: (error as Error).message } })
  }
}
