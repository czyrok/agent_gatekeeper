import * as egressRequestRepository from "@/server/repositories/egress-request-repository"
import * as allowlistService from "@/server/services/allowlist-service"
import * as egressRequestLifecycleService from "@/server/services/egress-request-lifecycle-service"
import * as notificationService from "@/server/services/notification-service"
import type { EgressRequest } from "@/shared/egress-request"

const DENIAL_BLOCK_MILLISECONDS = 3_600_000

async function submit(
  existing: EgressRequest | undefined,
  workspace: string,
  host: string,
  reason: string,
): Promise<EgressRequest> {
  if (existing?.status === "approved") return existing

  const now = new Date().toISOString()
  if (allowlistService.isAllowed(await allowlistService.readEntries(), host)) {
    if (existing?.status === "pending") {
      egressRequestLifecycleService.markHostAllowed(host)
      return egressRequestRepository.findById(existing.id) ?? existing
    }
    if (existing?.status === "stalled") return existing
    const allowed: EgressRequest = {
      id: crypto.randomUUID(),
      workspace,
      host,
      reason,
      status: "allowed",
      createdAt: now,
      decidedAt: now,
    }
    egressRequestRepository.insert(allowed)
    return allowed
  }

  if (existing?.status === "pending") return existing
  if (
    existing?.status === "denied" &&
    existing.decidedAt &&
    existing.decidedAt > egressRequestLifecycleService.ago(DENIAL_BLOCK_MILLISECONDS)
  ) {
    return existing
  }

  const request: EgressRequest = {
    id: crypto.randomUUID(),
    workspace,
    host,
    reason,
    status: "pending",
    createdAt: now,
    decidedAt: null,
  }
  egressRequestRepository.insert(request)
  await notificationService.notifyRequest(request).catch((error) => console.error(error))
  return request
}

export async function submitEgressRequest(
  workspace: string,
  host: string,
  reason: string,
  waitMilliseconds: number,
): Promise<EgressRequest> {
  egressRequestLifecycleService.expireStale()
  const existing = egressRequestRepository.findLatest(workspace, host)
  const submitted = await submit(existing, workspace, host, reason)
  return (await egressRequestLifecycleService.waitForChange(submitted.id, waitMilliseconds)) ?? submitted
}
