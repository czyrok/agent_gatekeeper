import type { APIRoute } from "astro"
import { listEgressRequests } from "@/server/use-cases/list-egress-requests"

export const GET: APIRoute = () => {
  try {
    return Response.json(listEgressRequests())
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 })
  }
}
