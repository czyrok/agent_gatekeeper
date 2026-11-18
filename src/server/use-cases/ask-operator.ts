import { postQuestion } from "@/server/infrastructure/control-plane"
import * as operatorQuestionRepository from "@/server/repositories/operator-question-repository"
import * as notificationService from "@/server/services/notification-service"
import * as operatorQuestionLifecycleService from "@/server/services/operator-question-lifecycle-service"
import type { OperatorQuestion } from "@/shared/operator-question"

export async function askOperator(
  workspace: string,
  question: string,
  waitMilliseconds: number,
): Promise<OperatorQuestion | undefined> {
  const latest = operatorQuestionRepository.findLatest(workspace)
  if (latest?.status === "pending") {
    return (await operatorQuestionLifecycleService.waitForAnswer(latest.id, waitMilliseconds)) ?? latest
  }

  const id = crypto.randomUUID()
  const item = await postQuestion(id, workspace, question)
  if (!item) return undefined

  const asked: OperatorQuestion = {
    id,
    workspace,
    itemKey: item.itemKey,
    itemName: item.itemName,
    itemUrl: item.url,
    question,
    status: "pending",
    answer: null,
    createdAt: new Date().toISOString(),
    answeredAt: null,
  }
  operatorQuestionRepository.insert(asked)
  notificationService.notifyQuestion(asked).catch((error) => console.error(error))
  return (await operatorQuestionLifecycleService.waitForAnswer(id, waitMilliseconds)) ?? asked
}

export async function awaitAnswer(workspace: string, waitMilliseconds: number): Promise<OperatorQuestion | undefined> {
  const latest = operatorQuestionRepository.findLatest(workspace)
  if (!latest) return undefined
  return (await operatorQuestionLifecycleService.waitForAnswer(latest.id, waitMilliseconds)) ?? latest
}

export function takePendingAnswer(workspace: string): { id: string; itemKey: string; answer: string } | undefined {
  const question = operatorQuestionRepository.findOldestAnswered(workspace)
  if (!question?.answer) return undefined
  return { id: question.id, itemKey: question.itemKey, answer: question.answer }
}

export function acknowledgeAnswer(workspace: string, id: string): void {
  if (operatorQuestionRepository.findById(id)?.workspace !== workspace) return
  operatorQuestionRepository.markDelivered(id)
}
