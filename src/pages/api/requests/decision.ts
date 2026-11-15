import type { APIRoute } from "astro"
import {
  decideEgressRequest,
  EgressRequestAlreadyDecidedError,
  UnknownEgressRequestError,
} from "@/server/use-cases/decide-egress-request"
import { EGRESS_DECISIONS } from "@/shared/egress-request"

function statusFor(error: unknown): number {
  if (error instanceof UnknownEgressRequestError) return 404
  if (error instanceof EgressRequestAlreadyDecidedError) return 409
  return 502
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}))
  const decision = EGRESS_DECISIONS.find((candidate) => candidate === body.decision)
  if (typeof body.id !== "string" || !decision) {
    return Response.json({ error: "Expected { id, decision: allow | deny | retry }" }, { status: 400 })
  }

  try {
    return Response.json(await decideEgressRequest(body.id, decision))
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: statusFor(error) })
  }
}
