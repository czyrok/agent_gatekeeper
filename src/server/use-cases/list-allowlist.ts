import * as allowlistService from "@/server/services/allowlist-service"

export function listAllowlist(): Promise<string[]> {
  return allowlistService.readEntries()
}
