import type { FileInfo, PackageJson, ReleaseType } from './types'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

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
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules')
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
export function updateVersionInFile(filePath: string, oldVersion: string, newVersion: string): FileInfo {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const isPackageJson = filePath.endsWith('package.json')

    let newContent: string
    let updated = false

    if (isPackageJson) {
      const packageJson = JSON.parse(content)
      if (packageJson.version === oldVersion) {
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
export function executeGit(args: string[]): string {
  try {
    return execSync(`git ${args.join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  }
  catch (error: any) {
    throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`)
  }
}

/**
 * Check git status
 */
export function checkGitStatus(): void {
  const status = executeGit(['status', '--porcelain'])
  if (status.trim()) {
    throw new Error(`Git working tree is not clean:\n${status}`)
  }
}

/**
 * Get current git branch
 */
export function getCurrentBranch(): string {
  return executeGit(['rev-parse', '--abbrev-ref', 'HEAD'])
}

/**
 * Create git commit
 */
export function createGitCommit(message: string, sign: boolean = false, noVerify: boolean = false): void {
  const args = ['commit', '-m', message]
  if (sign)
    args.push('--signoff')
  if (noVerify)
    args.push('--no-verify')

  executeGit(args)
}

/**
 * Create git tag
 */
export function createGitTag(tag: string, sign: boolean = false): void {
  const args = ['tag', tag]
  if (sign)
    args.push('--sign')

  executeGit(args)
}

/**
 * Push to git remote
 */
export function pushToRemote(tags: boolean = true): void {
  executeGit(['push'])
  if (tags) {
    executeGit(['push', '--tags'])
  }
}

/**
 * Get recent commits for display
 */
export function getRecentCommits(count: number = 10): string[] {
  const output = executeGit(['log', `--oneline`, `-${count}`])
  return output.split('\n').filter(line => line.trim())
}

/**
 * Execute shell command
 */
export function executeCommand(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: cwd || process.cwd(),
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
  return new Promise((resolve) => {
    process.stdout.write(`${question} `)
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim())
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
