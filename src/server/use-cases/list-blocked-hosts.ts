import * as proxyLogRepository from "@/server/repositories/proxy-log-repository"
import * as allowlistService from "@/server/services/allowlist-service"
import { parseRefusedHosts } from "@/server/services/tinyproxy-log-service"
import type { BlockedHost } from "@/shared/blocked-host"

const LOG_WINDOW_SECONDS = 86400

export async function listBlockedHosts(): Promise<BlockedHost[]> {
  const logs = await proxyLogRepository.readRecentLogs(LOG_WINDOW_SECONDS)
  const entries = await allowlistService.readEntries()
  return parseRefusedHosts(logs).filter(({ host }) => !allowlistService.isAllowed(entries, host))
}
