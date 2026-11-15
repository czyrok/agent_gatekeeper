import { env } from "@/server/infrastructure/env"
import { readConfigMap, replaceConfigMap, type ConfigMap } from "@/server/infrastructure/kubernetes"

export type AllowlistDocument = { configMap: ConfigMap; text: string }

export async function read(): Promise<AllowlistDocument> {
  const configMap = await readConfigMap(env("PROXY_NAMESPACE"), env("ALLOWLIST_CONFIG_MAP"))
  return { configMap, text: configMap.data[env("ALLOWLIST_KEY")] ?? "" }
}

export async function replace(document: AllowlistDocument, text: string): Promise<string> {
  const key = env("ALLOWLIST_KEY")
  const replaced = await replaceConfigMap(env("PROXY_NAMESPACE"), {
    ...document.configMap,
    data: { ...document.configMap.data, [key]: text },
  })
  return replaced.data[key]
}
