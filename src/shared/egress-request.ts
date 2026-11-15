export type EgressRequestStatus = "pending" | "approved" | "allowed" | "stalled" | "denied" | "expired"

export type EgressRequest = {
  id: string
  workspace: string
  host: string
  reason: string
  status: EgressRequestStatus
  createdAt: string
  decidedAt: string | null
}

export const EGRESS_DECISIONS = ["allow", "deny", "retry"] as const

export type EgressDecision = (typeof EGRESS_DECISIONS)[number]
