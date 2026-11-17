import { env } from "@/server/infrastructure/env"
import { listPods, readPodLog } from "@/server/infrastructure/kubernetes"

export async function readRecentLogs(sinceSeconds: number): Promise<string> {
  const namespace = env("PROXY_NAMESPACE")
  const pods = await listPods(namespace, env("PROXY_POD_SELECTOR"))
  const logs = await Promise.all(pods.map((pod) => readPodLog(namespace, pod, sinceSeconds)))
  return logs.join("\n")
}
