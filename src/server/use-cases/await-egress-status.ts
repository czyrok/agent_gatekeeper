import * as egressRequestRepository from "@/server/repositories/egress-request-repository"
import * as egressRequestLifecycleService from "@/server/services/egress-request-lifecycle-service"
import type { EgressRequest } from "@/shared/egress-request"

export async function awaitEgressStatus(
  workspace: string,
  host: string,
  waitMilliseconds: number,
): Promise<EgressRequest | undefined> {
  egressRequestLifecycleService.expireStale()
  const request = egressRequestRepository.findLatest(workspace, host)
  if (!request) return undefined
  return (await egressRequestLifecycleService.waitForChange(request.id, waitMilliseconds)) ?? request
}
