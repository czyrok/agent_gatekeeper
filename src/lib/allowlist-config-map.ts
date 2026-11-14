import { entryForHost, isAllowed, parseAllowlist } from "@/lib/allowlist"
import { env } from "@/lib/env"
import { ConflictError, readConfigMap, replaceConfigMap } from "@/lib/kubernetes"

export async function readEntries(): Promise<string[]> {
  const configMap = await readConfigMap(env("PROXY_NAMESPACE"), env("ALLOWLIST_CONFIG_MAP"))
  return parseAllowlist(configMap.data[env("ALLOWLIST_KEY")] ?? "")
}

export async function appendHost(host: string): Promise<string[]> {
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

export async function allowHost(host: string): Promise<string[]> {
  try {
    return await appendHost(host)
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error
    return appendHost(host)
  }
}
