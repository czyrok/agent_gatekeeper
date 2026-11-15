import type { EgressRequest } from "@/lib/egress-requests"
import { env } from "@/lib/env"

type Message = {
  title: string
  message: string
  tags: string[]
  click: string
  actions?: { action: "view"; label: string; url: string }[]
}

async function publish(message: Message): Promise<void> {
  const email = process.env.NOTIFICATION_EMAIL
  const response = await fetch(env("NTFY_URL"), {
    method: "POST",
    headers: { Authorization: `Bearer ${env("NTFY_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topic: env("NTFY_TOPIC"), ...message, ...(email ? { email } : {}) }),
  })
  if (!response.ok) throw new Error(`ntfy: ${response.status}`)
}

export function notifyRequest(request: EgressRequest): Promise<void> {
  const link = `${env("PUBLIC_URL")}/?request=${request.id}`
  return publish({
    title: `Egress request: ${request.host}`,
    message: `${request.workspace} asks for ${request.host}: ${request.reason}\n${link}`,
    tags: ["shield"],
    click: link,
    actions: [{ action: "view", label: "Review", url: link }],
  })
}

export function notifyStalled(host: string): Promise<void> {
  return publish({
    title: `Proxy did not reload: ${host}`,
    message: `${host} is in the allowlist but egress-proxy still refuses it after 3 minutes. Check kubectl -n coder-egress logs deploy/egress-proxy.`,
    tags: ["warning"],
    click: env("PUBLIC_URL"),
  })
}
