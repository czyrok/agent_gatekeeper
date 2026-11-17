import * as egressRequestRepository from "@/server/repositories/egress-request-repository"
import * as egressRequestLifecycleService from "@/server/services/egress-request-lifecycle-service"
import type { EgressRequest } from "@/shared/egress-request"

export function listEgressRequests(): EgressRequest[] {
  egressRequestLifecycleService.expireStale()
  return egressRequestRepository.findAll()
}
