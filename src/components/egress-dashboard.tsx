import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { EgressRequest } from "@/lib/egress-requests"
import type { BlockedHost } from "@/lib/tinyproxy-log"

const REFRESH_MILLISECONDS = 15_000
const LISTED_REQUEST_STATUSES: EgressRequest["status"][] = ["pending", "approved", "stalled", "denied", "expired"]

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  if (seconds > -60) return relativeTime.format(seconds, "second")
  if (seconds > -3600) return relativeTime.format(Math.round(seconds / 60), "minute")
  return relativeTime.format(Math.round(seconds / 3600), "hour")
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? `${response.status}`)
  return body
}

function RequestActions({
  request,
  pending,
  onDecide,
  fullWidth = false,
}: {
  request: EgressRequest
  pending: string | null
  onDecide: (id: string, decision: "allow" | "deny" | "retry") => void
  fullWidth?: boolean
}) {
  if (request.status === "approved") return <Badge>waiting for proxy</Badge>
  if (request.status === "expired") return <Badge variant="neutral">expired</Badge>
  if (request.status === "stalled" || request.status === "denied") {
    const [label, decision, action] =
      request.status === "stalled"
        ? (["proxy did not reload", "retry", "Retry"] as const)
        : (["denied", "allow", "Allow"] as const)
    return (
      <div className={fullWidth ? "flex items-center gap-2" : "flex items-center justify-end gap-2"}>
        <Badge variant="neutral">{label}</Badge>
        <Button
          className={fullWidth ? "flex-1" : undefined}
          size={fullWidth ? "default" : "sm"}
          disabled={pending === request.id}
          onClick={() => onDecide(request.id, decision)}
        >
          {action}
        </Button>
      </div>
    )
  }
  return (
    <div className={fullWidth ? "flex gap-2" : "flex justify-end gap-2"}>
      <Button
        className={fullWidth ? "flex-1" : undefined}
        size={fullWidth ? "default" : "sm"}
        disabled={pending === request.id}
        onClick={() => onDecide(request.id, "allow")}
      >
        Allow
      </Button>
      <Button
        className={fullWidth ? "flex-1" : undefined}
        size={fullWidth ? "default" : "sm"}
        variant="neutral"
        disabled={pending === request.id}
        onClick={() => onDecide(request.id, "deny")}
      >
        Deny
      </Button>
    </div>
  )
}

export function EgressDashboard() {
  const [requests, setRequests] = useState<EgressRequest[]>([])
  const [focusedRequest] = useState(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("request"),
  )
  const scrolledToFocus = useRef(false)
  const [blocked, setBlocked] = useState<BlockedHost[]>([])
  const [allowlist, setAllowlist] = useState<string[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [manualHost, setManualHost] = useState("")
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [nextRequests, nextBlocked, nextAllowlist] = await Promise.allSettled([
      getJson<EgressRequest[]>("/api/requests"),
      getJson<BlockedHost[]>("/api/blocked"),
      getJson<string[]>("/api/allowlist"),
    ])
    const failures: string[] = []
    if (nextRequests.status === "fulfilled") setRequests(nextRequests.value)
    else failures.push(`requests: ${(nextRequests.reason as Error).message}`)
    if (nextBlocked.status === "fulfilled") setBlocked(nextBlocked.value)
    else failures.push(`refused hosts: ${(nextBlocked.reason as Error).message}`)
    if (nextAllowlist.status === "fulfilled") setAllowlist(nextAllowlist.value)
    else failures.push(`allowlist: ${(nextAllowlist.reason as Error).message}`)
    setError(failures.length > 0 ? failures.join("; ") : null)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, REFRESH_MILLISECONDS)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (scrolledToFocus.current || !focusedRequest || requests.length === 0) return
    scrolledToFocus.current = true
    const visible = [...document.querySelectorAll<HTMLElement>(`[data-request="${CSS.escape(focusedRequest)}"]`)].find(
      (element) => element.offsetParent !== null,
    )
    visible?.scrollIntoView({ block: "center" })
  }, [focusedRequest, requests])

  async function decide(id: string, decision: "allow" | "deny" | "retry") {
    setPending(id)
    try {
      await getJson<EgressRequest>("/api/requests/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      })
      setError(null)
      await refresh()
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setPending(null)
    }
  }

  const listedRequests = requests.filter((request) => LISTED_REQUEST_STATUSES.includes(request.status))
  const focusClass = (id: string) => (id === focusedRequest ? "ring-4 ring-main" : "")

  async function allow(host: string) {
    setPending(host)
    try {
      await getJson<string[]>("/api/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host }),
      })
      setError(null)
      await refresh()
      return true
    } catch (failure) {
      setError((failure as Error).message)
      return false
    } finally {
      setPending(null)
    }
  }

  async function allowManualHost(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await allow(manualHost)) setManualHost("")
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agent requests</CardTitle>
        </CardHeader>
        <CardContent>
          {listedRequests.length === 0 ? (
            <Alert>
              <AlertTitle>No pending requests</AlertTitle>
            </Alert>
          ) : (
            <>
              <ul className="flex flex-col gap-4 sm:hidden">
                {listedRequests.map((request) => (
                  <li
                    key={request.id}
                    data-request={request.id}
                    className={`flex flex-col gap-3 rounded-base border-2 border-border bg-secondary-background p-4 ${focusClass(request.id)}`}
                  >
                    <span className="font-mono break-all">{request.host}</span>
                    <span className="text-sm">{request.reason}</span>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono break-all">{request.workspace}</span>
                      <span>{timeAgo(request.createdAt)}</span>
                    </div>
                    <RequestActions request={request} pending={pending} onDecide={decide} fullWidth />
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Host</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Asked</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listedRequests.map((request) => (
                      <TableRow key={request.id} data-request={request.id} className={focusClass(request.id)}>
                        <TableCell className="font-mono">{request.host}</TableCell>
                        <TableCell className="font-mono">{request.workspace}</TableCell>
                        <TableCell className="whitespace-normal">{request.reason}</TableCell>
                        <TableCell>{timeAgo(request.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <RequestActions request={request} pending={pending} onDecide={decide} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refused hosts</CardTitle>
        </CardHeader>
        <CardContent>
          {blocked.length === 0 ? (
            <Alert>
              <AlertTitle>Nothing refused in the last 24 h</AlertTitle>
            </Alert>
          ) : (
            <>
              <ul className="flex flex-col gap-4 sm:hidden">
                {blocked.map(({ host, count, lastSeen }) => (
                  <li
                    key={host}
                    className="flex flex-col gap-3 rounded-base border-2 border-border bg-secondary-background p-4"
                  >
                    <span className="font-mono break-all">{host}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge>{count}</Badge>
                      <span>{timeAgo(lastSeen)}</span>
                    </div>
                    <Button className="w-full" disabled={pending === host} onClick={() => allow(host)}>
                      Allow
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Host</TableHead>
                      <TableHead>Refusals</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocked.map(({ host, count, lastSeen }) => (
                      <TableRow key={host}>
                        <TableCell className="font-mono">{host}</TableCell>
                        <TableCell>
                          <Badge>{count}</Badge>
                        </TableCell>
                        <TableCell>{timeAgo(lastSeen)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" disabled={pending === host} onClick={() => allow(host)}>
                            Allow
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowlist</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-col gap-4 sm:flex-row" onSubmit={allowManualHost}>
            <Input
              placeholder="pypi.org"
              value={manualHost}
              onChange={(event) => setManualHost(event.target.value)}
            />
            <Button type="submit" disabled={manualHost === "" || pending === manualHost}>
              Allow
            </Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allowlist.map((entry) => (
                <TableRow key={entry}>
                  <TableCell className="font-mono">{entry}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
