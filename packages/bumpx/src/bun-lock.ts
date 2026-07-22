import { readFileSync, writeFileSync } from 'node:fs'

export interface BunLockUpdate {
  updated: boolean
  originalContent: string
}

interface ValueSpan {
  start: number
  end: number
}

function skipTrivia(content: string, offset: number, end = content.length): number {
  let index = offset
  while (index < end) {
    if (/\s/.test(content[index])) {
      index++
      continue
    }
    if (content[index] === '/' && content[index + 1] === '/') {
      index += 2
      while (index < end && content[index] !== '\n') index++
      continue
    }
    if (content[index] === '/' && content[index + 1] === '*') {
      const close = content.indexOf('*/', index + 2)
      if (close === -1 || close >= end)
        throw new Error('unterminated block comment')
      index = close + 2
      continue
    }
    break
  }
  return index
}

function readString(content: string, offset: number): { value: string, end: number } {
  if (content[offset] !== '"') throw new Error(`expected string at offset ${offset}`)
  let index = offset + 1
  while (index < content.length) {
    if (content[index] === '\\') {
      index += 2
      continue
    }
    if (content[index] === '"') {
      const raw = content.slice(offset, index + 1)
      return { value: JSON.parse(raw), end: index + 1 }
    }
    index++
  }
  throw new Error('unterminated string')
}

function scanContainer(content: string, offset: number): number {
  const stack = [content[offset]]
  if (stack[0] !== '{' && stack[0] !== '[')
    throw new Error(`expected object or array at offset ${offset}`)

  let index = offset + 1
  while (index < content.length && stack.length > 0) {
    index = skipTrivia(content, index)
    const character = content[index]
    if (character === '"') {
      index = readString(content, index).end
      continue
    }
    if (character === '{' || character === '[') {
      stack.push(character)
      index++
      continue
    }
    if (character === '}' || character === ']') {
      const open = stack.pop()
      if ((open === '{' && character !== '}') || (open === '[' && character !== ']'))
        throw new Error(`mismatched delimiter at offset ${index}`)
      index++
      continue
    }
    index++
  }

  if (stack.length > 0) throw new Error('unterminated object or array')
  return index
}

function scanValue(content: string, offset: number, objectEnd: number): number {
  const character = content[offset]
  if (character === '"') return readString(content, offset).end
  if (character === '{' || character === '[') return scanContainer(content, offset)

  let index = offset
  while (index < objectEnd && content[index] !== ',' && content[index] !== '}') index++
  return index
}

function findPropertyValue(content: string, objectSpan: ValueSpan, property: string): ValueSpan | undefined {
  if (content[objectSpan.start] !== '{')
    throw new Error(`expected ${JSON.stringify(property)} parent to be an object`)

  let index = objectSpan.start + 1
  const objectEnd = objectSpan.end - 1
  while (index < objectEnd) {
    index = skipTrivia(content, index, objectEnd)
    if (content[index] === ',') {
      index++
      continue
    }
    if (index >= objectEnd) break

    const key = readString(content, index)
    index = skipTrivia(content, key.end, objectEnd)
    if (content[index] !== ':') throw new Error(`expected colon after ${JSON.stringify(key.value)}`)
    index = skipTrivia(content, index + 1, objectEnd)
    const valueEnd = scanValue(content, index, objectEnd)
    if (key.value === property) return { start: index, end: valueEnd }
    index = valueEnd
  }
  return undefined
}

function parseBunLock(content: string): any {
  const withoutComments = content.replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n\r]*/g, match => match.startsWith('"') ? match : '')
  const withoutTrailingCommas = withoutComments.replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(withoutTrailingCommas)
}

export function updateBunWorkspaceLock(
  lockPath: string,
  workspaceVersions: ReadonlyMap<string, string>,
  dryRun = false,
): BunLockUpdate {
  const originalContent = readFileSync(lockPath, 'utf8')
  let lock: any
  try {
    lock = parseBunLock(originalContent)
  }
  catch (error) {
    throw new Error(`Malformed bun.lock: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!lock || typeof lock !== 'object' || !lock.workspaces || typeof lock.workspaces !== 'object' || Array.isArray(lock.workspaces))
    throw new Error('Malformed bun.lock: expected a workspaces object')

  try {
    const rootEnd = scanContainer(originalContent, skipTrivia(originalContent, 0))
    if (skipTrivia(originalContent, rootEnd) !== originalContent.length)
      throw new Error('unexpected content after root object')
    const rootSpan = { start: skipTrivia(originalContent, 0), end: rootEnd }
    const workspacesSpan = findPropertyValue(originalContent, rootSpan, 'workspaces')
    if (!workspacesSpan || originalContent[workspacesSpan.start] !== '{')
      throw new Error('expected a workspaces object')

    const replacements: Array<{ start: number, end: number, value: string }> = []
    for (const [workspacePath, version] of workspaceVersions) {
      const workspace = lock.workspaces[workspacePath]
      if (workspace === undefined) continue
      if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace))
        throw new Error(`workspace ${JSON.stringify(workspacePath)} must be an object`)
      if (!Object.hasOwn(workspace, 'version')) continue
      if (typeof workspace.version !== 'string')
        throw new Error(`workspace ${JSON.stringify(workspacePath)} version must be a string`)
      if (workspace.version === version) continue

      const workspaceSpan = findPropertyValue(originalContent, workspacesSpan, workspacePath)
      if (!workspaceSpan || originalContent[workspaceSpan.start] !== '{')
        throw new Error(`cannot locate workspace ${JSON.stringify(workspacePath)}`)
      const versionSpan = findPropertyValue(originalContent, workspaceSpan, 'version')
      if (!versionSpan || originalContent[versionSpan.start] !== '"')
        throw new Error(`cannot locate version for workspace ${JSON.stringify(workspacePath)}`)
      replacements.push({ ...versionSpan, value: JSON.stringify(version) })
    }

    if (replacements.length === 0) return { updated: false, originalContent }
    let updatedContent = originalContent
    for (const replacement of replacements.sort((a, b) => b.start - a.start))
      updatedContent = `${updatedContent.slice(0, replacement.start)}${replacement.value}${updatedContent.slice(replacement.end)}`
    if (!dryRun) writeFileSync(lockPath, updatedContent, 'utf8')
    return { updated: true, originalContent }
  }
  catch (error) {
    throw new Error(`Malformed bun.lock: ${error instanceof Error ? error.message : String(error)}`)
  }
}
