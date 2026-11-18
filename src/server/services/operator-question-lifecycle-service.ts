import { readQuestion } from "@/server/infrastructure/control-plane"
import * as operatorQuestionRepository from "@/server/repositories/operator-question-repository"
import type { OperatorQuestion } from "@/shared/operator-question"

const SYNC_INTERVAL_MILLISECONDS = 10_000

const waiters = new Map<string, Set<() => void>>()
let syncing = false

function wakeWaiters(id: string): void {
  for (const wake of [...(waiters.get(id) ?? [])]) wake()
}

export async function syncAnswers(): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    for (const question of operatorQuestionRepository.findPending()) {
      try {
        const status = await readQuestion(question.id)
        if (!status.answered || status.answer === null) continue
        operatorQuestionRepository.setAnswer(question.id, status.answer)
        wakeWaiters(question.id)
      } catch (error) {
        console.error(`question ${question.id}:`, error)
      }
    }
  } finally {
    syncing = false
  }
}

export function waitForAnswer(id: string, milliseconds: number): Promise<OperatorQuestion | undefined> {
  const current = operatorQuestionRepository.findById(id)
  if (current?.status !== "pending") return Promise.resolve(current)

  return new Promise((resolve) => {
    const questionWaiters = waiters.get(id) ?? new Set<() => void>()
    waiters.set(id, questionWaiters)
    const wake = () => {
      clearTimeout(timeout)
      questionWaiters.delete(wake)
      if (questionWaiters.size === 0) waiters.delete(id)
      resolve(operatorQuestionRepository.findById(id))
    }
    const timeout = setTimeout(wake, milliseconds)
    questionWaiters.add(wake)
  })
}

setInterval(syncAnswers, SYNC_INTERVAL_MILLISECONDS).unref()
