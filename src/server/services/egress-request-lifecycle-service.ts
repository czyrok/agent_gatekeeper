import * as egressRequestRepository from "@/server/repositories/egress-request-repository"
import { notifyStalled } from "@/server/services/notification-service"
import { isFilteredByProxy } from "@/server/services/proxy-probe-service"
import type { EgressRequest, EgressRequestStatus } from "@/shared/egress-request"

const REQUEST_LIFETIME_MILLISECONDS = 3_600_000
const RETENTION_MILLISECONDS = 86_400_000
const PROXY_PROBE_INTERVAL_MILLISECONDS = 5_000
const PROXY_PROBE_TRIES = 36

const waiters = new Map<string, Set<() => void>>()
const confirming = new Set<string>()

export function ago(milliseconds: number): string {
  return new Date(Date.now() - milliseconds).toISOString()
}

export function setStatus(request: EgressRequest, status: EgressRequestStatus): void {
  egressRequestRepository.updateStatus(request.id, status, status === "pending" ? null : new Date().toISOString())
  for (const wake of [...(waiters.get(request.id) ?? [])]) wake()
}

export function expireStale(): void {
  for (const request of egressRequestRepository.findPendingCreatedBefore(ago(REQUEST_LIFETIME_MILLISECONDS))) {
    setStatus(request, "expired")
  }
  egressRequestRepository.deleteDecidedBefore(ago(RETENTION_MILLISECONDS))
}

export async function confirmThroughProxy(host: string): Promise<void> {
  if (confirming.has(host)) return
  confirming.add(host)
  try {
    for (let attempt = 0; attempt < PROXY_PROBE_TRIES; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, PROXY_PROBE_INTERVAL_MILLISECONDS))
      const filtered = await isFilteredByProxy(host).catch(() => true)
      if (!filtered) {
        for (const request of egressRequestRepository.findByHostAndStatus(host, "approved")) {
          setStatus(request, "allowed")
        }
        return
      }
    }
    const stalled = egressRequestRepository.findByHostAndStatus(host, "approved")
    for (const request of stalled) setStatus(request, "stalled")
    if (stalled.length > 0) await notifyStalled(host).catch((error) => console.error(error))
  } finally {
    confirming.delete(host)
  }
}

export function markHostAllowed(host: string): void {
  expireStale()
  for (const request of egressRequestRepository.findByHostAndStatus(host, "pending")) setStatus(request, "approved")
  if (egressRequestRepository.findByHostAndStatus(host, "approved").length > 0) void confirmThroughProxy(host)
}

export function waitForChange(id: string, milliseconds: number): Promise<EgressRequest | undefined> {
  expireStale()
  const current = egressRequestRepository.findById(id)
  if (current?.status !== "pending" && current?.status !== "approved") return Promise.resolve(current)

  return new Promise((resolve) => {
    const requestWaiters = waiters.get(id) ?? new Set<() => void>()
    waiters.set(id, requestWaiters)
    const wake = () => {
      clearTimeout(timeout)
      requestWaiters.delete(wake)
      if (requestWaiters.size === 0) waiters.delete(id)
      resolve(egressRequestRepository.findById(id))
    }
    const timeout = setTimeout(wake, milliseconds)
    requestWaiters.add(wake)
  })
}

for (const host of egressRequestRepository.findApprovedHosts()) void confirmThroughProxy(host)
setInterval(expireStale, 60_000).unref()
