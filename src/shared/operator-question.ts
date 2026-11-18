export type OperatorQuestionStatus = "pending" | "answered" | "delivered"

export type OperatorQuestion = {
  id: string
  workspace: string
  itemKey: string
  itemName: string
  itemUrl: string
  question: string
  status: OperatorQuestionStatus
  answer: string | null
  createdAt: string
  answeredAt: string | null
}
