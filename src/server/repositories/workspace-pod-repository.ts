import { env } from "@/server/infrastructure/env"
import { findPodLabelsByIp } from "@/server/infrastructure/kubernetes"

export function findLabelsByIp(ip: string): Promise<Record<string, string> | undefined> {
  return findPodLabelsByIp(env("WORKSPACES_NAMESPACE"), ip)
}
