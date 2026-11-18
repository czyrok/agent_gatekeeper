import { database } from "@/server/infrastructure/database"
import type { OperatorQuestion, OperatorQuestionStatus } from "@/shared/operator-question"

type Row = {
  id: string
  workspace: string
  item_key: string
  item_name: string
  item_url: string
  question: string
  status: OperatorQuestionStatus
  answer: string | null
  created_at: string
  answered_at: string | null
}

const statements = {
  insert: database.prepare(
    "INSERT INTO operator_questions (id, workspace, item_key, item_name, item_url, question, status, answer, created_at, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ),
  selectById: database.prepare("SELECT * FROM operator_questions WHERE id = ?"),
  selectLatest: database.prepare(
    "SELECT * FROM operator_questions WHERE workspace = ? ORDER BY created_at DESC LIMIT 1",
  ),
  selectPending: database.prepare("SELECT * FROM operator_questions WHERE status = 'pending' ORDER BY created_at"),
  selectOldestAnswered: database.prepare(
    "SELECT * FROM operator_questions WHERE workspace = ? AND status = 'answered' ORDER BY created_at ASC LIMIT 1",
  ),
  updateAnswer: database.prepare(
    "UPDATE operator_questions SET status = 'answered', answer = ?, answered_at = ? WHERE id = ? AND status = 'pending'",
  ),
  updateDelivered: database.prepare(
    "UPDATE operator_questions SET status = 'delivered' WHERE id = ? AND status = 'answered'",
  ),
}

function toQuestion(row: Row): OperatorQuestion {
  return {
    id: row.id,
    workspace: row.workspace,
    itemKey: row.item_key,
    itemName: row.item_name,
    itemUrl: row.item_url,
    question: row.question,
    status: row.status,
    answer: row.answer,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
  }
}

export function insert(question: OperatorQuestion): void {
  statements.insert.run(
    question.id,
    question.workspace,
    question.itemKey,
    question.itemName,
    question.itemUrl,
    question.question,
    question.status,
    question.answer,
    question.createdAt,
    question.answeredAt,
  )
}

export function findById(id: string): OperatorQuestion | undefined {
  const row = statements.selectById.get(id) as Row | undefined
  return row && toQuestion(row)
}

export function findLatest(workspace: string): OperatorQuestion | undefined {
  const row = statements.selectLatest.get(workspace) as Row | undefined
  return row && toQuestion(row)
}

export function findPending(): OperatorQuestion[] {
  return (statements.selectPending.all() as Row[]).map(toQuestion)
}

export function findOldestAnswered(workspace: string): OperatorQuestion | undefined {
  const row = statements.selectOldestAnswered.get(workspace) as Row | undefined
  return row && toQuestion(row)
}

export function setAnswer(id: string, answer: string): void {
  statements.updateAnswer.run(answer, new Date().toISOString(), id)
}

export function markDelivered(id: string): void {
  statements.updateDelivered.run(id)
}
