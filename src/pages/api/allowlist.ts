import type { APIRoute } from "astro"
import { entryForHost, isAllowed, isValidHost, parseAllowlist } from "@/lib/allowlist"
import { env } from "@/lib/env"
import { ConflictError, readConfigMap, replaceConfigMap } from "@/lib/kubernetes"

async function readEntries(): Promise<string[]> {
  const configMap = await readConfigMap(env("PROXY_NAMESPACE"), env("ALLOWLIST_CONFIG_MAP"))
  return parseAllowlist(configMap.data[env("ALLOWLIST_KEY")] ?? "")
}

async function appendHost(host: string): Promise<string[]> {
  const namespace = env("PROXY_NAMESPACE")
  const key = env("ALLOWLIST_KEY")
  const configMap = await readConfigMap(namespace, env("ALLOWLIST_CONFIG_MAP"))
  const text = configMap.data[key] ?? ""
  const entries = parseAllowlist(text)
  if (isAllowed(entries, host)) return entries

  const separator = text === "" || text.endsWith("\n") ? "" : "\n"
  configMap.data[key] = `${text}${separator}${entryForHost(host)}\n`
  const replaced = await replaceConfigMap(namespace, configMap)
  return parseAllowlist(replaced.data[key])
}

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
    try {
      return Response.json(await appendHost(host))
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error
      return Response.json(await appendHost(host))
    }
  } catch (error) {
    const status = error instanceof ConflictError ? 409 : 502
    return Response.json({ error: (error as Error).message }, { status })
  }
}
