import type { DashboardState } from "@/client/state/dashboard-state"
import type { EgressRequestStatus } from "@/shared/egress-request"

const LISTED_REQUEST_STATUSES: EgressRequestStatus[] = ["pending", "approved", "stalled", "denied", "expired"]

export const selectRequests = (state: DashboardState) => state.requests

export const selectListedRequests = (state: DashboardState) =>
  state.requests.filter((request) => LISTED_REQUEST_STATUSES.includes(request.status))

export const selectBlockedHosts = (state: DashboardState) => state.blocked

export const selectAllowlist = (state: DashboardState) => state.allowlist

export const selectPending = (state: DashboardState) => state.pending

export const selectError = (state: DashboardState) => state.error
