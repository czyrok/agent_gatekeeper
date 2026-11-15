import type { APIRoute } from "astro"
import { isAllowed, parseAllowlist } from "@/server/services/allowlist-service"
import { env } from "@/server/infrastructure/env"
import { listPods, readConfigMap, readPodLog } from "@/server/infrastructure/kubernetes"
import { parseRefusedHosts } from "@/server/services/tinyproxy-log-service"

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
