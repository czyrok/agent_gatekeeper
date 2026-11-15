import { getJson } from "@/client/resources/http"
import type { BlockedHost } from "@/shared/blocked-host"

export function fetchBlockedHosts(): Promise<BlockedHost[]> {
  return getJson<BlockedHost[]>("/api/blocked")
}
