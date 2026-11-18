const REQUEST_TIMEOUT_MILLISECONDS = 30_000

export type QuestionItem = { itemKey: string; itemName: string; url: string }

function controlPlaneUrl(): string {
  return process.env.CONTROL_PLANE_URL ?? ""
}

export async function postQuestion(id: string, workspace: string, question: string): Promise<QuestionItem | undefined> {
  const url = controlPlaneUrl()
  if (!url) return undefined
  const response = await fetch(`${url}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, workspace, question }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`POST /questions: ${response.status}`)
  return response.json()
}

export async function readQuestion(id: string): Promise<{ answered: boolean; answer: string | null }> {
  const response = await fetch(`${controlPlaneUrl()}/questions/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  })
  if (!response.ok) throw new Error(`GET /questions/${id}: ${response.status}`)
  return response.json()
}
