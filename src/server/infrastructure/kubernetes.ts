import { readFile } from "node:fs/promises"

const API = "https://kubernetes.default.svc"
const REQUEST_TIMEOUT_MILLISECONDS = 10_000
const TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token"

export type ConfigMap = {
  metadata: { name: string; resourceVersion: string }
  data: Record<string, string>
}

export class ConflictError extends Error {}

async function request(path: string, init: RequestInit = {}) {
  const token = (await readFile(TOKEN_PATH, "utf8")).trim()
  const response = await fetch(`${API}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  if (response.status === 409) throw new ConflictError(path)
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${response.status}`)
  return response
}

export async function listPods(namespace: string, labelSelector: string): Promise<string[]> {
  const response = await request(
    `/api/v1/namespaces/${namespace}/pods?labelSelector=${encodeURIComponent(labelSelector)}`,
  )
  const pods: { items: { metadata: { name: string } }[] } = await response.json()
  return pods.items.map((pod) => pod.metadata.name)
}

export async function findPodLabelsByIp(namespace: string, ip: string): Promise<Record<string, string> | undefined> {
  const response = await request(
    `/api/v1/namespaces/${namespace}/pods?fieldSelector=${encodeURIComponent(`status.podIP=${ip},status.phase=Running`)}`,
  )
  const pods: { items: { metadata: { labels?: Record<string, string> } }[] } = await response.json()
  return pods.items[0]?.metadata.labels
}

export async function readPodLog(namespace: string, pod: string, sinceSeconds: number): Promise<string> {
  const response = await request(`/api/v1/namespaces/${namespace}/pods/${pod}/log?sinceSeconds=${sinceSeconds}`)
  return response.text()
}

export async function readConfigMap(namespace: string, name: string): Promise<ConfigMap> {
  const response = await request(`/api/v1/namespaces/${namespace}/configmaps/${name}`)
  return response.json()
}

export async function replaceConfigMap(namespace: string, configMap: ConfigMap): Promise<ConfigMap> {
  const response = await request(`/api/v1/namespaces/${namespace}/configmaps/${configMap.metadata.name}`, {
    method: "PUT",
    body: JSON.stringify(configMap),
  })
  return response.json()
}
