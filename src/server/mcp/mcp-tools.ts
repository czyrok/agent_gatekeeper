import { isValidHost } from "@/server/services/allowlist-service"
import { awaitEgressStatus } from "@/server/use-cases/await-egress-status"
import { submitEgressRequest } from "@/server/use-cases/submit-egress-request"
import type { EgressRequest } from "@/shared/egress-request"

const WAIT_MILLISECONDS = 25_000

const HOST_PROPERTY = { type: "string", description: "Host name only, e.g. pypi.org" }

export const TOOLS = [
  {
    name: "request_egress",
    description:
      "Ask the operator to allow a host the egress proxy refused (HTTP 403 on CONNECT). Waits up to 25 s; if still pending, call egress_status with the same host.",
    inputSchema: {
      type: "object",
      properties: {
        host: HOST_PROPERTY,
        reason: { type: "string", description: "Why the task needs it" },
      },
      required: ["host", "reason"],
    },
  },
  {
    name: "egress_status",
    description: "Wait up to 25 s for the operator's decision on a host requested with request_egress.",
    inputSchema: {
      type: "object",
      properties: { host: HOST_PROPERTY },
      required: ["host"],
    },
  },
]

function statusText(request: EgressRequest): string {
  const host = request.host
  switch (request.status) {
    case "allowed":
      return `Allowed: ${host} is reachable through the proxy now. Retry the request.`
    case "pending":
      return `Pending: the operator has been notified. Call egress_status with host ${host} to keep waiting.`
    case "approved":
      return "Approved: waiting for the proxy to reload (up to a minute). Call egress_status again."
    case "stalled":
      return `Stalled: ${host} was approved but the proxy still refuses it. Do not retry; tell the user the egress proxy did not reload.`
    case "denied":
      return `Denied: do not retry ${host}. Continue without it or tell the user.`
    case "expired":
      return `Expired: nobody answered within an hour. Tell the user ${host} is still blocked.`
  }
}

async function callEgressTool(
  name: "request_egress" | "egress_status",
  args: Record<string, unknown>,
  workspace: string,
): Promise<{ text: string; isError: boolean }> {
  const host = typeof args.host === "string" ? args.host.trim().toLowerCase() : ""
  if (!isValidHost(host)) return { text: `Not a host name: ${host}`, isError: true }

  let request: EgressRequest | undefined
  if (name === "request_egress") {
    const reason = typeof args.reason === "string" ? args.reason.trim() : ""
    request = await submitEgressRequest(workspace, host, reason, WAIT_MILLISECONDS)
  } else {
    request = await awaitEgressStatus(workspace, host, WAIT_MILLISECONDS)
    if (!request) {
      return {
        text: `Unknown: no request for ${host} in this workspace (the gatekeeper may have restarted). Call request_egress again.`,
        isError: false,
      }
    }
  }

  return { text: statusText(request), isError: false }
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  workspace: string,
): Promise<{ text: string; isError: boolean }> {
  switch (name) {
    case "request_egress":
    case "egress_status":
      return callEgressTool(name, args, workspace)
    default:
      return { text: `Unknown tool: ${name}`, isError: true }
  }
}
