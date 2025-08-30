import type { FileInfo, PackageJson, ReleaseType } from './types'
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import readline from 'node:readline'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { SemVer } from 'semver'

export { SemVer }

/**
 * Load gitignore patterns from .gitignore file
 */
async function loadGitignorePatterns(dir: string): Promise<string[]> {
  const gitignorePath = join(dir, '.gitignore')
  if (!existsSync(gitignorePath)) {
    return []
  }

  try {
    const content = await readFile(gitignorePath, 'utf-8')
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
  } catch {
    return []
  }
}

/**
 * Check if a path should be ignored based on gitignore patterns
 */
function shouldIgnorePath(fullPath: string, rootDir: string, patterns: string[]): boolean {
  const relativePath = relative(rootDir, fullPath)

  for (const pattern of patterns) {
    // Simple pattern matching - could be enhanced with proper glob matching
    if (pattern.endsWith('/')) {
      // Directory pattern
      const dirPattern = pattern.slice(0, -1)
      if (relativePath === dirPattern || relativePath.startsWith(dirPattern + '/')) {
        return true
      }
    } else {
      // File or directory pattern
      if (relativePath === pattern || relativePath.includes('/' + pattern)) {
        return true
      }
      // Wildcard support for basic patterns
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        if (regex.test(relativePath)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Check if a string is a valid release type
 */
export function isReleaseType(value: string): value is ReleaseType {
  return ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'].includes(value)
}

/**
 * Check if a string is a valid semver version
 */
export function isValidVersion(version: string): boolean {
  try {
    const _ = new SemVer(version)
    return true
  }
  catch {
    return false
  }
}

/**
 * Increment version based on release type or specific version
 */
export function incrementVersion(currentVersion: string, release: string | ReleaseType, preid?: string): string {
  if (isValidVersion(release)) {
    return release
  }

  if (isReleaseType(release)) {
    const semver = new SemVer(currentVersion)
    return semver.inc(release, preid).toString()
  }

  throw new Error(`Invalid release type or version: ${release}`)
}

/**
 * Find package.json files in the current directory and subdirectories
 */
export async function findPackageJsonFiles(dir: string = process.cwd(), recursive: boolean = false, respectGitignore: boolean = true): Promise<string[]> {
  const packageFiles: string[] = []

  const packageJsonPath = join(dir, 'package.json')
  if (existsSync(packageJsonPath)) {
    packageFiles.push(packageJsonPath)
  }

  if (recursive) {
    try {
      const entries = await readdir(dir)
      const excludedDirs = new Set([
        'node_modules',
        'dist',
        'coverage',
        'lib',
        'out',
        'target',
        '.git',
        '.svn',
        '.hg',
        '.next',
        '.nuxt',
        '.output',
        '.vercel',
        '.netlify',
      ])

      // Load gitignore patterns if respectGitignore is true
      let gitignorePatterns: string[] = []
      if (respectGitignore) {
        gitignorePatterns = await loadGitignorePatterns(dir)
      }

      for (const entry of entries) {
        // Skip hidden directories and common build/output directories
        if (entry.startsWith('.') || excludedDirs.has(entry))
          continue

        const fullPath = join(dir, entry)

        // Check if this path should be ignored by gitignore
        if (respectGitignore && shouldIgnorePath(fullPath, dir, gitignorePatterns)) {
          continue
        }

        const stats = await stat(fullPath)
        if (stats.isDirectory()) {
          const subPackages = await findPackageJsonFiles(fullPath, true, respectGitignore)
          packageFiles.push(...subPackages)
        }
      }
    }
    catch {
      // Ignore errors when reading directories
    }
  }

  return packageFiles
}

/**
 * Get workspace packages from package.json workspaces field
 */
export async function getWorkspacePackages(rootDir: string = process.cwd()): Promise<string[]> {
  try {
    const rootPackageJsonPath = join(rootDir, 'package.json')
    if (!existsSync(rootPackageJsonPath)) {
      return []
    }

    const rootPackageJson = readPackageJson(rootPackageJsonPath)
    if (!rootPackageJson.workspaces) {
      return []
    }

    // Handle both array format and object format
    const workspacePatterns = Array.isArray(rootPackageJson.workspaces)
      ? rootPackageJson.workspaces
      : rootPackageJson.workspaces.packages || []

    const workspacePackages: string[] = []

    for (const pattern of workspacePatterns) {
      // Simple pattern matching for common cases like "packages/*"
      if (pattern.endsWith('/*')) {
        const baseDir = pattern.slice(0, -2) // Remove /*
        const fullBaseDir = join(rootDir, baseDir)

        if (existsSync(fullBaseDir)) {
          try {
            const entries = await readdir(fullBaseDir)
            for (const entry of entries) {
              if (entry.startsWith('.'))
                continue // Skip hidden directories

              const entryPath = join(fullBaseDir, entry)
              const stats = await stat(entryPath)
              if (stats.isDirectory()) {
                const packageJsonPath = join(entryPath, 'package.json')
                if (existsSync(packageJsonPath)) {
                  workspacePackages.push(packageJsonPath)
                }
              }
            }
          }
          catch {
            // Ignore errors reading directory
          }
        }
      }
      else {
        // Handle exact paths like "packages/specific-package"
        const packageJsonPath = join(rootDir, pattern, 'package.json')
        if (existsSync(packageJsonPath)) {
          workspacePackages.push(packageJsonPath)
        }
      }
    }

    return workspacePackages
  }
  catch (error) {
    console.warn(`Warning: Failed to get workspace packages: ${error}`)
    return []
  }
}

/**
 * Find all package.json files, prioritizing workspace-aware discovery
 */
export async function findAllPackageFiles(dir: string = process.cwd(), recursive: boolean = false, respectGitignore: boolean = true): Promise<string[]> {
  const packageFiles: string[] = []

  // Always include the root package.json
  const rootPackageJsonPath = join(dir, 'package.json')
  if (existsSync(rootPackageJsonPath)) {
    packageFiles.push(rootPackageJsonPath)
  }

  if (recursive) {
    // First try workspace-aware discovery
    const workspacePackages = await getWorkspacePackages(dir)
    if (workspacePackages.length > 0) {
      // Use workspace-defined packages
      for (const packagePath of workspacePackages) {
        if (!packageFiles.includes(packagePath)) {
          packageFiles.push(packagePath)
        }
      }
    }
    else {
      // Fallback to recursive directory search
      const recursivePackages = await findPackageJsonFiles(dir, true, respectGitignore)
      for (const packagePath of recursivePackages) {
        if (!packageFiles.includes(packagePath)) {
          packageFiles.push(packagePath)
        }
      }
    }
  }

  return packageFiles
}

/**
 * Read and parse package.json file
 */
export function readPackageJson(filePath: string): PackageJson {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }
  catch (error) {
    throw new Error(`Failed to read package.json at ${filePath}: ${error}`)
  }
}

/**
 * Write package.json file
 */
export function writePackageJson(filePath: string, packageJson: PackageJson): void {
  try {
    const content = `${JSON.stringify(packageJson, null, 2)}\n`
    writeFileSync(filePath, content, 'utf-8')
  }
  catch (error) {
    throw new Error(`Failed to write package.json at ${filePath}: ${error}`)
  }
}

/**
 * Update version in a file (supports various file types)
 */
export function updateVersionInFile(filePath: string, oldVersion: string, newVersion: string, forceUpdate: boolean = false): FileInfo {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const isPackageJson = filePath.endsWith('package.json')

    let newContent: string
    let updated = false

    if (isPackageJson) {
      const packageJson = JSON.parse(content)
      if (packageJson.version === oldVersion || forceUpdate) {
        packageJson.version = newVersion
        newContent = `${JSON.stringify(packageJson, null, 2)}\n`
        updated = true
      }
      else {
        newContent = content
      }
    }
    else {
      // For other files, try to replace version strings
      const versionRegex = new RegExp(`\\b${escapeRegExp(oldVersion)}\\b`, 'g')
      newContent = content.replace(versionRegex, newVersion)
      updated = newContent !== content
    }

    if (updated) {
      writeFileSync(filePath, newContent, 'utf-8')
    }

    return {
      path: filePath,
      content: newContent,
      updated,
      oldVersion: updated ? oldVersion : undefined,
      newVersion: updated ? newVersion : undefined,
    }
  }
  catch (error) {
    throw new Error(`Failed to update version in ${filePath}: ${error}`)
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Execute git command
 */
export function executeGit(args: string[], cwd?: string): string {
  try {
    // Use spawnSync for proper argument handling
    const result = spawnSync('git', args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: cwd ?? process.cwd(),
    })

    if (result.error) {
      throw result.error
    }

    if (result.status !== 0) {
      throw new Error(result.stderr || 'Git command failed')
    }

    return result.stdout.trim()
  }
  catch (error: any) {
    throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`)
  }
}

/**
 * Check git status
 */
export function checkGitStatus(cwd?: string): void {
  const status = executeGit(['status', '--porcelain'], cwd)
  if (status.trim()) {
    throw new Error(`Git working tree is not clean:\n${status}`)
  }
}

/**
 * Get current git branch
 */
export function getCurrentBranch(cwd?: string): string {
  return executeGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
}

/**
 * Check if the current directory is a Git repository
 */
export function isGitRepository(cwd?: string): boolean {
  try {
    const result = executeGit(['rev-parse', '--is-inside-work-tree'], cwd)
    return result.trim() === 'true'
  }
  catch {
    return false
  }
}

/**
 * Create git commit
 */
export function createGitCommit(message: string, sign: boolean = false, noVerify: boolean = false, cwd?: string): void {
  const args = ['commit', '-m', message]
  if (sign)
    args.push('--signoff')
  if (noVerify)
    args.push('--no-verify')

  executeGit(args, cwd)
}

/**
 * Check if git tag exists
 */
export function gitTagExists(tag: string, cwd?: string): boolean {
  try {
    // Use show-ref to check if tag exists
    executeGit(['show-ref', '--tags', '--quiet', '--verify', `refs/tags/${tag}`], cwd)
    return true
  } catch {
    return false
  }
}

/**
 * Create git tag
 */
export function createGitTag(tag: string, sign: boolean = false, message?: string, cwd?: string): void {
  // Check if tag already exists
  if (gitTagExists(tag, cwd)) {
    throw new Error(`Git tag '${tag}' already exists. Use a different version.`)
  }

  const args = ['tag']
  if (message) {
    args.push('-a', tag, '-m', message)
  }
  else {
    args.push(tag)
  }
  if (sign)
    args.push('--sign')

  executeGit(args, cwd)
}

/**
 * Check if current branch has an upstream and is safe to pull
 */
export function canSafelyPull(cwd?: string): boolean {
  try {
    // Check if we're in a detached HEAD state
    const currentBranch = getCurrentBranch(cwd)
    if (currentBranch === 'HEAD') {
      return false
    }

    // Check if branch has upstream
    executeGit(['rev-parse', '--abbrev-ref', '@{upstream}'], cwd)
    return true
  }
  catch {
    return false
  }
}

/**
 * Push to git remote (with pull-before-push safety)
 */
export function pushToRemote(tags: boolean = true, cwd?: string): void {
  // First, pull to ensure we have the latest changes (if safe to do so)
  if (canSafelyPull(cwd)) {
    try {
      // Pull latest changes from remote
      executeGit(['pull'], cwd)
    }
    catch (error: any) {
      const errorMessage = error.message.toLowerCase()

      if (errorMessage.includes('conflict') || errorMessage.includes('merge')) {
        throw new Error(`Pull failed due to conflicts. Please resolve conflicts manually and try again.\n${error.message}`)
      }
      else {
        throw new Error(`Failed to pull from remote: ${error.message}`)
      }
    }
  }
  else {
    console.warn('⚠️  No upstream branch configured or in detached HEAD. Skipping pull...')
  }

  // Use atomic push to avoid race conditions between commit and tag pushes
  if (tags) {
    // Pushing commits and tags to remote
    executeGit(['push', '--follow-tags'], cwd)
  }
  else {
    // Pushing commits to remote
    executeGit(['push'], cwd)
  }
}

/**
 * Get recent commits for display
 */
export function getRecentCommits(count: number = 10, cwd?: string): string[] {
  const output = executeGit(['log', `--oneline`, `-${count}`], cwd)
  return output.split('\n').filter(line => line.trim())
}

/**
 * Execute shell command
 */
export function executeCommand(command: string, cwd?: string): string {
  try {
    // Add a safe timeout in CI to prevent long-hanging commands (e.g., npm install)
    // Can be overridden via BUMPX_CMD_TIMEOUT_MS env var
    const timeoutMs = process.env.BUMPX_CMD_TIMEOUT_MS
      ? Number.parseInt(process.env.BUMPX_CMD_TIMEOUT_MS, 10)
      : (process.env.CI ? 4000 : undefined)

    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: cwd || process.cwd(),
      // Only set timeout when defined (Node rejects undefined)
      ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
    }).trim()
  }
  catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`)
  }
}

/**
 * Simple prompting utility (since we're avoiding dependencies)
 */
export function prompt(question: string): Promise<string> {
  // Prevent prompting during tests to avoid hanging
  if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test' || process.argv.includes('test')) {
    return Promise.resolve('test-answer')
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(`${question} `, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Console symbols for better output
 */
export const symbols = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  question: '?',
}

/**
 * Colorize console output (simple ANSI colors)
 */
export const colors = {
  green: (text: string) => `\x1B[32m${text}\x1B[0m`,
  red: (text: string) => `\x1B[31m${text}\x1B[0m`,
  yellow: (text: string) => `\x1B[33m${text}\x1B[0m`,
  blue: (text: string) => `\x1B[34m${text}\x1B[0m`,
  gray: (text: string) => `\x1B[90m${text}\x1B[0m`,
  bold: (text: string) => `\x1B[1m${text}\x1B[0m`,
}
