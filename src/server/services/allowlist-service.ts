import { ConflictError } from "@/server/infrastructure/kubernetes"
import * as allowlistRepository from "@/server/repositories/allowlist-repository"

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

export function parseAllowlist(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
}

export function isValidHost(host: string): boolean {
  return HOST.test(host)
}

export function entryForHost(host: string): string {
  return `^${host.toLowerCase().replaceAll(".", "\\.")}$`
}

const POSIX_CLASSES: Record<string, string> = {
  alnum: "a-zA-Z0-9",
  alpha: "a-zA-Z",
  digit: "0-9",
  lower: "a-z",
  upper: "A-Z",
  space: "\\s",
  xdigit: "0-9A-Fa-f",
  punct: "!-\\/:-@\\[-`{-~",
}

function toJsRegExp(entry: string): RegExp {
  return new RegExp(
    entry.replace(/\[:(\w+):\]/g, (match, name: string) => POSIX_CLASSES[name] ?? match),
    "i",
  )
}

export function isAllowed(entries: string[], host: string): boolean {
  return entries.some((entry) => {
    try {
      return toJsRegExp(entry).test(host)
    } catch {
      return false
    }
  })
}

export async function readEntries(): Promise<string[]> {
  return parseAllowlist((await allowlistRepository.read()).text)
}

async function appendHost(host: string): Promise<string[]> {
  const document = await allowlistRepository.read()
  const entries = parseAllowlist(document.text)
  if (isAllowed(entries, host)) return entries

  const separator = document.text === "" || document.text.endsWith("\n") ? "" : "\n"
  return parseAllowlist(await allowlistRepository.replace(document, `${document.text}${separator}${entryForHost(host)}\n`))
}

export async function allowHost(host: string): Promise<string[]> {
  try {
    return await appendHost(host)
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error
    return appendHost(host)
  }
}
