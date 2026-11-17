import * as allowlistService from "@/server/services/allowlist-service"
import * as egressRequestLifecycleService from "@/server/services/egress-request-lifecycle-service"

export async function allowHost(host: string): Promise<string[]> {
  const entries = await allowlistService.allowHost(host)
  egressRequestLifecycleService.markHostAllowed(host)
  return entries
}
