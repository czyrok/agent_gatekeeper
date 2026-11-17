import { getJson } from "@/client/resources/http"
import type { EgressDecision, EgressRequest } from "@/shared/egress-request"

export function fetchEgressRequests(): Promise<EgressRequest[]> {
  return getJson<EgressRequest[]>("/api/requests")
}

export function postEgressDecision(id: string, decision: EgressDecision): Promise<EgressRequest> {
  return getJson<EgressRequest>("/api/requests/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, decision }),
  })
}
