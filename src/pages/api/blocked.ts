import type { APIRoute } from "astro"
import { isAllowed, parseAllowlist } from "@/lib/allowlist"
import { env } from "@/lib/env"
import { listPods, readConfigMap, readPodLog } from "@/lib/kubernetes"
import { parseRefusedHosts } from "@/lib/tinyproxy-log"

const LOG_WINDOW_SECONDS = 86400

export const GET: APIRoute = async () => {
  try {
    const namespace = env("PROXY_NAMESPACE")
    const pods = await listPods(namespace, env("PROXY_POD_SELECTOR"))
    const logs = await Promise.all(pods.map((pod) => readPodLog(namespace, pod, LOG_WINDOW_SECONDS)))
    const configMap = await readConfigMap(namespace, env("ALLOWLIST_CONFIG_MAP"))
    const entries = parseAllowlist(configMap.data[env("ALLOWLIST_KEY")] ?? "")

    const blocked = parseRefusedHosts(logs.join("\n")).filter(({ host }) => !isAllowed(entries, host))
    return Response.json(blocked)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 })
  }
}
