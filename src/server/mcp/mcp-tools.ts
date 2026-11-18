import { isValidHost } from "@/server/services/allowlist-service"
import { askOperator, awaitAnswer } from "@/server/use-cases/ask-operator"
import { awaitEgressStatus } from "@/server/use-cases/await-egress-status"
import { submitEgressRequest } from "@/server/use-cases/submit-egress-request"
import type { EgressRequest } from "@/shared/egress-request"
import type { OperatorQuestion } from "@/shared/operator-question"

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
  {
    name: "ask_operator",
    description:
      "Ask the operator what you cannot settle yourself. Posts it on your Plane work item, moves the item to Waiting and notifies them. Waits up to 25 s; if still pending, end your turn: the answer is typed into this session when it arrives.",
    inputSchema: {
      type: "object",
      properties: { question: { type: "string", description: "Every open question, batched in one Markdown message" } },
      required: ["question"],
    },
  },
  {
    name: "answer_status",
    description: "Wait up to 25 s for the answer to your last ask_operator question.",
    inputSchema: { type: "object", properties: {} },
  },
]

const UNLINKED_TEXT =
  "This workspace was not started from a Plane work item; ask the user in this session instead."

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

function questionText(question: OperatorQuestion): string {
  if (question.status === "pending") {
    return "Pending: the operator has been notified. End your turn now; the answer will arrive as your next message."
  }
  return `Answered: ${question.answer}`
}

async function callQuestionTool(
  name: "ask_operator" | "answer_status",
  args: Record<string, unknown>,
  workspace: string,
): Promise<{ text: string; isError: boolean }> {
  if (name === "answer_status") {
    const question = await awaitAnswer(workspace, WAIT_MILLISECONDS)
    return { text: question ? questionText(question) : "Unknown: no question was asked from this workspace.", isError: false }
  }
  const text = typeof args.question === "string" ? args.question.trim() : ""
  if (!text) return { text: "question is empty", isError: true }
  const question = await askOperator(workspace, text, WAIT_MILLISECONDS)
  return { text: question ? questionText(question) : UNLINKED_TEXT, isError: false }
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
    case "ask_operator":
    case "answer_status":
      return callQuestionTool(name, args, workspace)
    default:
      return { text: `Unknown tool: ${name}`, isError: true }
  }
}
