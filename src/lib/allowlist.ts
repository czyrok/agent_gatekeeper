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

export function isAllowed(entries: string[], host: string): boolean {
  return entries.some((entry) => {
    try {
      return new RegExp(entry).test(host)
    } catch {
      return false
    }
  })
}
