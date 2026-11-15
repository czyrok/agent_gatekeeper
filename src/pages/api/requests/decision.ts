import type { APIRoute } from "astro"
import { decide } from "@/server/services/egress-request-lifecycle-service"

const DECISIONS = ["allow", "deny", "retry"] as const

function statusFor(message: string): number {
  switch (message) {
    case "unknown request":
      return 404
    case "already decided":
      return 409
    default:
      return 502
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}))
  const decision = DECISIONS.find((candidate) => candidate === body.decision)
  if (typeof body.id !== "string" || !decision) {
    return Response.json({ error: "Expected { id, decision: allow | deny | retry }" }, { status: 400 })
  }

  try {
    return Response.json(await decide(body.id, decision))
  } catch (error) {
    const message = (error as Error).message
    return Response.json({ error: message }, { status: statusFor(message) })
  }
}
