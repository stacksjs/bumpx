import { readFileSync, writeFileSync } from 'node:fs'

export interface PantryLockUpdate {
  updated: boolean
  originalContent: string
}

export function updatePantryWorkspaceLock(
  lockPath: string,
  workspaceVersions: ReadonlyMap<string, string>,
  dryRun = false,
): PantryLockUpdate {
  const originalContent = readFileSync(lockPath, 'utf8')
  let lock: any
  try {
    lock = JSON.parse(originalContent)
  }
  catch (error) {
    throw new Error(`Malformed pantry.lock: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!lock || typeof lock !== 'object' || !lock.workspaces || typeof lock.workspaces !== 'object' || Array.isArray(lock.workspaces))
    throw new Error('Malformed pantry.lock: expected a workspaces object')

  let updated = false
  for (const [workspacePath, version] of workspaceVersions) {
    const entry = lock.workspaces[workspacePath]
    if (entry === undefined) continue
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error(`Malformed pantry.lock: workspace ${JSON.stringify(workspacePath)} must be an object`)
    if (!Object.hasOwn(entry, 'version')) continue
    if (entry.version === version) continue
    entry.version = version
    updated = true
  }

  if (updated && !dryRun)
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8')

  return { updated, originalContent }
}
