import type { APIRoute } from "astro"
import { isValidHost } from "@/lib/allowlist"
import { allowHost, readEntries } from "@/lib/allowlist-config-map"
import { markHostAllowed } from "@/lib/egress-requests"
import { ConflictError } from "@/lib/kubernetes"

export const GET: APIRoute = async () => {
  try {
    return Response.json(await readEntries())
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}))
  const host = typeof body.host === "string" ? body.host.trim().toLowerCase() : ""
  if (!isValidHost(host)) return Response.json({ error: `Not a host name: ${host}` }, { status: 400 })

  try {
    const entries = await allowHost(host)
    markHostAllowed(host)
    return Response.json(entries)
  } catch (error) {
    const status = error instanceof ConflictError ? 409 : 502
    return Response.json({ error: (error as Error).message }, { status })
  }
}
