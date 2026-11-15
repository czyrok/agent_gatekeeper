import type { BlockedHost } from "@/shared/blocked-host"

const REFUSED = /^NOTICE\s+(\w{3} \d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \[\d+\]: Proxying refused on filtered domain "([^"]+)"$/

function toIsoString(timestamp: string, now: Date): string {
  const date = new Date(`${timestamp} ${now.getUTCFullYear()} UTC`)
  if (date > now) date.setUTCFullYear(date.getUTCFullYear() - 1)
  return date.toISOString()
}

export function parseRefusedHosts(log: string): BlockedHost[] {
  const now = new Date()
  const hosts = new Map<string, BlockedHost>()

  for (const line of log.split("\n")) {
    const match = REFUSED.exec(line.trimEnd())
    if (!match) continue

    const lastSeen = toIsoString(match[1], now)
    const host = match[2].toLowerCase()
    const known = hosts.get(host)

    if (known) {
      known.count += 1
      if (lastSeen > known.lastSeen) known.lastSeen = lastSeen
    } else {
      hosts.set(host, { host, count: 1, lastSeen })
    }
  }

  return [...hosts.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
}
