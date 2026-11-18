import type { APIRoute } from "astro"
import { acknowledgeAnswer, takePendingAnswer } from "@/server/use-cases/ask-operator"
import { identifyWorkspace } from "@/server/use-cases/identify-workspace"

async function callerWorkspace(request: Request, clientAddress: string): Promise<string | Response> {
  if (request.headers.has("x-forwarded-for")) {
    return Response.json({ error: "Answers are served to workspaces only" }, { status: 403 })
  }
  const ip = clientAddress.replace(/^::ffff:/, "")
  const workspace = await identifyWorkspace(ip)
  if (!workspace) {
    console.warn(`answers: no workspace pod has IP ${ip}`)
    return Response.json({ error: "Not a workspace", ip }, { status: 403 })
  }
  return workspace
}

export const GET: APIRoute = async ({ request, clientAddress }) => {
  const workspace = await callerWorkspace(request, clientAddress)
  if (workspace instanceof Response) return workspace
  const pending = takePendingAnswer(workspace)
  if (!pending) return new Response(null, { status: 204 })
  return new Response(pending.answer, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Answer-Id": pending.id, "X-Item-Key": pending.itemKey },
  })
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const workspace = await callerWorkspace(request, clientAddress)
  if (workspace instanceof Response) return workspace
  acknowledgeAnswer(workspace, (await request.text()).trim())
  return new Response(null, { status: 204 })
}
