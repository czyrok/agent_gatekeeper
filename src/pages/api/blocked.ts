import type { APIRoute } from "astro"
import { listBlockedHosts } from "@/server/use-cases/list-blocked-hosts"

export const GET: APIRoute = async () => {
  try {
    return Response.json(await listBlockedHosts())
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 })
  }
}
