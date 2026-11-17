import * as egressRequestRepository from "@/server/repositories/egress-request-repository"
import * as allowlistService from "@/server/services/allowlist-service"
import * as egressRequestLifecycleService from "@/server/services/egress-request-lifecycle-service"
import type { EgressDecision, EgressRequest } from "@/shared/egress-request"

export class UnknownEgressRequestError extends Error {
  constructor() {
    super("unknown request")
  }
}

export class EgressRequestAlreadyDecidedError extends Error {
  constructor() {
    super("already decided")
  }
}

export async function decideEgressRequest(id: string, decision: EgressDecision): Promise<EgressRequest> {
  egressRequestLifecycleService.expireStale()
  const request = egressRequestRepository.findById(id)
  if (!request) throw new UnknownEgressRequestError()

  if (decision === "retry" && request.status === "stalled") {
    egressRequestLifecycleService.setStatus(request, "approved")
    void egressRequestLifecycleService.confirmThroughProxy(request.host)
  } else if (decision === "deny" && request.status === "pending") {
    egressRequestLifecycleService.setStatus(request, "denied")
  } else if (decision === "allow" && (request.status === "pending" || request.status === "denied")) {
    await allowlistService.allowHost(request.host)
    if (request.status === "denied") egressRequestLifecycleService.setStatus(request, "approved")
    egressRequestLifecycleService.markHostAllowed(request.host)
  } else {
    throw new EgressRequestAlreadyDecidedError()
  }
  return egressRequestRepository.findById(id) ?? request
}
