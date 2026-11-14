import { useCallback, useEffect, useState, type SubmitEvent } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { BlockedHost } from "@/lib/tinyproxy-log"

const REFRESH_MILLISECONDS = 15_000

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

export function EgressDashboard() {
  const [blocked, setBlocked] = useState<BlockedHost[]>([])
  const [allowlist, setAllowlist] = useState<string[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [manualHost, setManualHost] = useState("")
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextBlocked, nextAllowlist] = await Promise.all([
        getJson<BlockedHost[]>("/api/blocked"),
        getJson<string[]>("/api/allowlist"),
      ])
      setBlocked(nextBlocked)
      setAllowlist(nextAllowlist)
      setError(null)
    } catch (failure) {
      setError((failure as Error).message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, REFRESH_MILLISECONDS)
    return () => clearInterval(interval)
  }, [refresh])

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
