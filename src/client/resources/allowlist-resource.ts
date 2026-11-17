import { getJson } from "@/client/resources/http"

export function fetchAllowlist(): Promise<string[]> {
  return getJson<string[]>("/api/allowlist")
}

export function postAllowlistHost(host: string): Promise<string[]> {
  return getJson<string[]>("/api/allowlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host }),
  })
}
