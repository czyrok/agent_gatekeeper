import type { APIRoute } from "astro"
import { ConflictError } from "@/server/infrastructure/kubernetes"
import { isValidHost } from "@/server/services/allowlist-service"
import { allowHost } from "@/server/use-cases/allow-host"
import { listAllowlist } from "@/server/use-cases/list-allowlist"

export const GET: APIRoute = async () => {
  try {
    return Response.json(await listAllowlist())
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}))
  const host = typeof body.host === "string" ? body.host.trim().toLowerCase() : ""
  if (!isValidHost(host)) return Response.json({ error: `Not a host name: ${host}` }, { status: 400 })

  try {
    return Response.json(await allowHost(host))
  } catch (error) {
    const status = error instanceof ConflictError ? 409 : 502
    return Response.json({ error: (error as Error).message }, { status })
  }
}
