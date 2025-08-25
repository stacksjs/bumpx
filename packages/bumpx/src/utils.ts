import type { FileInfo, PackageJson, ReleaseType } from './types'
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import readline from 'node:readline'

/**
 * Semver version manipulation utilities
 */
export class SemVer {
  major: number
  minor: number
  patch: number
  prerelease: string[]
  build: string[]

  constructor(version: string) {
    const parsed = this.parse(version)
    this.major = parsed.major
    this.minor = parsed.minor
    this.patch = parsed.patch
    this.prerelease = parsed.prerelease
    this.build = parsed.build
  }

  private parse(version: string) {
    const cleanVersion = version.replace(/^v/, '')
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Z-]+(?:\.[0-9A-Z-]+)*))?(?:\+([0-9A-Z-]+(?:\.[0-9A-Z-]+)*))?$/i)

    if (!match) {
      throw new Error(`Invalid version: ${version}`)
    }

    return {
      major: Number.parseInt(match[1], 10),
      minor: Number.parseInt(match[2], 10),
      patch: Number.parseInt(match[3], 10),
      prerelease: match[4] ? match[4].split('.') : [],
      build: match[5] ? match[5].split('.') : [],
    }
  }

  inc(release: ReleaseType, preid?: string): SemVer {
    const newVersion = new SemVer(this.toString())

    switch (release) {
      case 'major':
        newVersion.major++
        newVersion.minor = 0
        newVersion.patch = 0
        newVersion.prerelease = []
        break
      case 'minor':
        newVersion.minor++
        newVersion.patch = 0
        newVersion.prerelease = []
        break
      case 'patch':
        newVersion.patch++
        newVersion.prerelease = []
        break
      case 'premajor':
        newVersion.major++
        newVersion.minor = 0
        newVersion.patch = 0
        newVersion.prerelease = [preid || 'alpha', '0']
        break
      case 'preminor':
        newVersion.minor++
        newVersion.patch = 0
        newVersion.prerelease = [preid || 'alpha', '0']
        break
      case 'prepatch':
        newVersion.patch++
        newVersion.prerelease = [preid || 'alpha', '0']
        break
      case 'prerelease':
        if (newVersion.prerelease.length === 0) {
          newVersion.patch++
          newVersion.prerelease = [preid || 'alpha', '0']
        }
        else {
          const lastIndex = newVersion.prerelease.length - 1
          const last = newVersion.prerelease[lastIndex]
          if (/^\d+$/.test(last)) {
            newVersion.prerelease[lastIndex] = String(Number.parseInt(last, 10) + 1)
          }
          else {
            newVersion.prerelease.push('0')
          }
        }
        break
    }

    return newVersion
  }

  toString(): string {
    let version = `${this.major}.${this.minor}.${this.patch}`
    if (this.prerelease.length > 0) {
      version += `-${this.prerelease.join('.')}`
    }
    return version
  }
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
export async function findPackageJsonFiles(dir: string = process.cwd(), recursive: boolean = false): Promise<string[]> {
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

      for (const entry of entries) {
        // Skip hidden directories and common build/output directories
        if (entry.startsWith('.') || excludedDirs.has(entry))
          continue

        const fullPath = join(dir, entry)
        const stats = await stat(fullPath)
        if (stats.isDirectory()) {
          const subPackages = await findPackageJsonFiles(fullPath, true)
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
export async function findAllPackageFiles(dir: string = process.cwd(), recursive: boolean = false): Promise<string[]> {
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
      const recursivePackages = await findPackageJsonFiles(dir, true)
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
      cwd: cwd || process.cwd(),
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
 * Create git tag
 */
export function createGitTag(tag: string, sign: boolean = false, message?: string, cwd?: string): void {
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
