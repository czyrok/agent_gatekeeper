import { useSyncExternalStore } from "react"
import type { BlockedHost } from "@/shared/blocked-host"
import type { EgressRequest } from "@/shared/egress-request"

export type DashboardState = {
  requests: EgressRequest[]
  blocked: BlockedHost[]
  allowlist: string[]
  pending: string | null
  error: string | null
}

const INITIAL_STATE: DashboardState = Object.freeze({
  requests: [],
  blocked: [],
  allowlist: [],
  pending: null,
  error: null,
})

let state = INITIAL_STATE
const listeners = new Set<() => void>()

export function getDashboardState(): DashboardState {
  return state
}

export function setDashboardState(patch: Partial<DashboardState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDashboardState<T>(selector: (state: DashboardState) => T): T {
  return selector(useSyncExternalStore(subscribe, getDashboardState, () => INITIAL_STATE))
}
