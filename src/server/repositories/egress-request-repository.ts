import { database } from "@/server/infrastructure/database"
import type { EgressRequest, EgressRequestStatus } from "@/shared/egress-request"

type Row = {
  id: string
  workspace: string
  host: string
  reason: string
  status: EgressRequestStatus
  created_at: string
  decided_at: string | null
}

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
  selectOverduePending: database.prepare("SELECT * FROM egress_requests WHERE status = 'pending' AND created_at < ?"),
  deleteOld: database.prepare("DELETE FROM egress_requests WHERE status <> 'pending' AND decided_at < ?"),
}

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

export function insert(request: EgressRequest): void {
  statements.insert.run(
    request.id,
    request.workspace,
    request.host,
    request.reason,
    request.status,
    request.createdAt,
    request.decidedAt,
  )
}

export function findById(id: string): EgressRequest | undefined {
  const row = statements.selectById.get(id) as Row | undefined
  return row && toRequest(row)
}

export function findLatest(workspace: string, host: string): EgressRequest | undefined {
  const row = statements.selectLatest.get(workspace, host) as Row | undefined
  return row && toRequest(row)
}

export function findByHostAndStatus(host: string, status: EgressRequestStatus): EgressRequest[] {
  return (statements.selectByHostAndStatus.all(host, status) as Row[]).map(toRequest)
}

export function findApprovedHosts(): string[] {
  return (statements.selectApprovedHosts.all() as { host: string }[]).map(({ host }) => host)
}

export function findAll(): EgressRequest[] {
  return (statements.selectAll.all() as Row[]).map(toRequest)
}

export function updateStatus(id: string, status: EgressRequestStatus, decidedAt: string | null): void {
  statements.updateStatus.run(status, decidedAt, id)
}

export function findPendingCreatedBefore(iso: string): EgressRequest[] {
  return (statements.selectOverduePending.all(iso) as Row[]).map(toRequest)
}

export function deleteDecidedBefore(iso: string): void {
  statements.deleteOld.run(iso)
}
