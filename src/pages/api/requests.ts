import type { APIRoute } from "astro"
import { listRequests } from "@/server/services/egress-request-lifecycle-service"

export const GET: APIRoute = () => {
  try {
    return Response.json(listRequests())
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 })
  }
}
