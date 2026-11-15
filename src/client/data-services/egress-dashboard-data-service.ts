import { fetchAllowlist, postAllowlistHost } from "@/client/resources/allowlist-resource"
import { fetchBlockedHosts } from "@/client/resources/blocked-hosts-resource"
import { fetchEgressRequests, postEgressDecision } from "@/client/resources/egress-requests-resource"
import { setDashboardState, type DashboardState } from "@/client/state/dashboard-state"
import type { EgressDecision } from "@/shared/egress-request"

const REFRESH_MILLISECONDS = 15_000

export async function refreshDashboard(): Promise<void> {
  const [requests, blocked, allowlist] = await Promise.allSettled([
    fetchEgressRequests(),
    fetchBlockedHosts(),
    fetchAllowlist(),
  ])
  const patch: Partial<DashboardState> = {}
  const failures: string[] = []
  if (requests.status === "fulfilled") patch.requests = requests.value
  else failures.push(`requests: ${(requests.reason as Error).message}`)
  if (blocked.status === "fulfilled") patch.blocked = blocked.value
  else failures.push(`refused hosts: ${(blocked.reason as Error).message}`)
  if (allowlist.status === "fulfilled") patch.allowlist = allowlist.value
  else failures.push(`allowlist: ${(allowlist.reason as Error).message}`)
  setDashboardState({ ...patch, error: failures.length > 0 ? failures.join("; ") : null })
}

export function startDashboardPolling(): () => void {
  void refreshDashboard()
  const interval = setInterval(refreshDashboard, REFRESH_MILLISECONDS)
  return () => clearInterval(interval)
}

async function runAction(key: string, action: () => Promise<unknown>): Promise<boolean> {
  setDashboardState({ pending: key })
  try {
    await action()
    setDashboardState({ error: null })
    await refreshDashboard()
    return true
  } catch (failure) {
    setDashboardState({ error: (failure as Error).message })
    return false
  } finally {
    setDashboardState({ pending: null })
  }
}

export function decideEgressRequest(id: string, decision: EgressDecision): Promise<boolean> {
  return runAction(id, () => postEgressDecision(id, decision))
}

export function allowHost(host: string): Promise<boolean> {
  return runAction(host, () => postAllowlistHost(host))
}
