import { isAllowed } from "@/lib/allowlist"
import { allowHost, readEntries } from "@/lib/allowlist-config-map"
import { database } from "@/lib/database"
import { notifyRequest, notifyStalled } from "@/lib/ntfy"
import { isFilteredByProxy } from "@/lib/proxy-probe"

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

type Row = {
  id: string
  workspace: string
  host: string
  reason: string
  status: EgressRequestStatus
  created_at: string
  decided_at: string | null
}

const REQUEST_LIFETIME_MILLISECONDS = 3_600_000
const DENIAL_BLOCK_MILLISECONDS = 3_600_000
const RETENTION_MILLISECONDS = 86_400_000
const PROXY_PROBE_INTERVAL_MILLISECONDS = 5_000
const PROXY_PROBE_TRIES = 36

const statements = {
  insert: database.prepare(
    "INSERT INTO egress_requests (id, workspace, host, reason, status, created_at, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ),
  selectById: database.prepare("SELECT * FROM egress_requests WHERE id = ?"),
  selectLatest: database.prepare(
    "SELECT * FROM egress_requests WHERE workspace = ? AND host = ? ORDER BY created_at DESC LIMIT 1",
  ),
  selectByHostAndStatus: database.prepare("SELECT * FROM egress_requests WHERE host = ? AND status = ?"),
  selectApprovedHosts: database.prepare("SELECT DISTINCT host FROM egress_requests WHERE status = 'approved'"),
  selectAll: database.prepare("SELECT * FROM egress_requests ORDER BY created_at DESC"),
  updateStatus: database.prepare("UPDATE egress_requests SET status = ?, decided_at = ? WHERE id = ?"),
  expirePending: database.prepare(
    "UPDATE egress_requests SET status = 'expired', decided_at = ? WHERE status = 'pending' AND created_at < ?",
  ),
  deleteOld: database.prepare("DELETE FROM egress_requests WHERE status <> 'pending' AND decided_at < ?"),
}

const waiters = new Map<string, Set<() => void>>()
const confirming = new Set<string>()

function toRequest(row: Row): EgressRequest {
  return {
    id: row.id,
    workspace: row.workspace,
    host: row.host,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  }
}

function ago(milliseconds: number): string {
  return new Date(Date.now() - milliseconds).toISOString()
}

function selectById(id: string): EgressRequest | undefined {
  const row = statements.selectById.get(id) as Row | undefined
  return row && toRequest(row)
}

function selectByHostAndStatus(host: string, status: EgressRequestStatus): EgressRequest[] {
  return (statements.selectByHostAndStatus.all(host, status) as Row[]).map(toRequest)
}

function setStatus(request: EgressRequest, status: EgressRequestStatus): void {
  statements.updateStatus.run(status, status === "pending" ? null : new Date().toISOString(), request.id)
  for (const wake of [...(waiters.get(request.id) ?? [])]) wake()
}

function expireStale(): void {
  statements.expirePending.run(new Date().toISOString(), ago(REQUEST_LIFETIME_MILLISECONDS))
  statements.deleteOld.run(ago(RETENTION_MILLISECONDS))
}

async function confirmThroughProxy(host: string): Promise<void> {
  if (confirming.has(host)) return
  confirming.add(host)
  try {
    for (let attempt = 0; attempt < PROXY_PROBE_TRIES; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, PROXY_PROBE_INTERVAL_MILLISECONDS))
      const filtered = await isFilteredByProxy(host).catch(() => true)
      if (!filtered) {
        for (const request of selectByHostAndStatus(host, "approved")) setStatus(request, "allowed")
        return
      }
    }
    const stalled = selectByHostAndStatus(host, "approved")
    for (const request of stalled) setStatus(request, "stalled")
    if (stalled.length > 0) await notifyStalled(host).catch((error) => console.error(error))
  } finally {
    confirming.delete(host)
  }
}

export function findRequest(workspace: string, host: string): EgressRequest | undefined {
  expireStale()
  const row = statements.selectLatest.get(workspace, host) as Row | undefined
  return row && toRequest(row)
}

export function markHostAllowed(host: string): void {
  expireStale()
  for (const request of selectByHostAndStatus(host, "pending")) setStatus(request, "approved")
  if (selectByHostAndStatus(host, "approved").length > 0) void confirmThroughProxy(host)
}

export async function submitRequest(workspace: string, host: string, reason: string): Promise<EgressRequest> {
  const existing = findRequest(workspace, host)
  if (existing?.status === "approved") return existing

  const now = new Date().toISOString()
  if (isAllowed(await readEntries(), host)) {
    if (existing?.status === "pending") {
      markHostAllowed(host)
      return selectById(existing.id) ?? existing
    }
    if (existing?.status === "stalled") return existing
    return { id: crypto.randomUUID(), workspace, host, reason, status: "allowed", createdAt: now, decidedAt: now }
  }

  if (existing?.status === "pending") return existing
  if (existing?.status === "denied" && existing.decidedAt && existing.decidedAt > ago(DENIAL_BLOCK_MILLISECONDS)) {
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
  statements.insert.run(request.id, workspace, host, reason, request.status, request.createdAt, null)
  await notifyRequest(request).catch((error) => console.error(error))
  return request
}

export async function decide(id: string, decision: "allow" | "deny"): Promise<EgressRequest> {
  expireStale()
  const request = selectById(id)
  if (!request) throw new Error("unknown request")
  if (request.status !== "pending") throw new Error("already decided")

  if (decision === "deny") {
    setStatus(request, "denied")
  } else {
    await allowHost(request.host)
    markHostAllowed(request.host)
  }
  return selectById(id) ?? request
}

export function waitForChange(id: string, milliseconds: number): Promise<EgressRequest | undefined> {
  expireStale()
  const current = selectById(id)
  if (current?.status !== "pending" && current?.status !== "approved") return Promise.resolve(current)

  return new Promise((resolve) => {
    const requestWaiters = waiters.get(id) ?? new Set<() => void>()
    waiters.set(id, requestWaiters)
    const wake = () => {
      clearTimeout(timeout)
      requestWaiters.delete(wake)
      if (requestWaiters.size === 0) waiters.delete(id)
      resolve(selectById(id))
    }
    const timeout = setTimeout(wake, milliseconds)
    requestWaiters.add(wake)
  })
}

export function listRequests(): EgressRequest[] {
  expireStale()
  return (statements.selectAll.all() as Row[]).map(toRequest)
}

for (const { host } of statements.selectApprovedHosts.all() as { host: string }[]) void confirmThroughProxy(host)
