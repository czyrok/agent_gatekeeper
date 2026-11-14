import { connect } from "node:net"
import { env } from "@/lib/env"

const PROBE_TIMEOUT_MILLISECONDS = 10_000

export function isFilteredByProxy(host: string): Promise<boolean> {
  const url = new URL(env("PROXY_URL"))
  return new Promise((resolve, reject) => {
    const socket = connect({ host: url.hostname, port: Number(url.port) })
    let received = ""

    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`proxy probe for ${host} timed out`))
    }, PROBE_TIMEOUT_MILLISECONDS)

    socket.on("connect", () => {
      socket.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n`)
    })
    socket.on("data", (chunk) => {
      received += chunk.toString("latin1")
      const end = received.indexOf("\r\n")
      if (end === -1) return
      clearTimeout(timeout)
      socket.destroy()
      const status = /^HTTP\/1\.[01] (\d{3})/.exec(received.slice(0, end))?.[1]
      if (status === undefined) reject(new Error(`unexpected proxy reply: ${received.slice(0, end)}`))
      else resolve(status === "403")
    })
    socket.on("error", (error) => {
      clearTimeout(timeout)
      socket.destroy()
      reject(error)
    })
  })
}
