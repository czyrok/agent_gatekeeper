import * as workspacePodRepository from "@/server/repositories/workspace-pod-repository"

export async function identifyWorkspace(ip: string): Promise<string | undefined> {
  const labels = await workspacePodRepository.findLabelsByIp(ip).catch(() => undefined)
  if (!labels?.["coder.workspace_name"]) return undefined
  return `${labels["coder.workspace_owner"]}/${labels["coder.workspace_name"]}`
}
