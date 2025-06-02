export type ReleaseType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'

export interface VersionBumpOptions {
  // Core options
  release?: string | ReleaseType
  preid?: string
  currentVersion?: string
  files?: string[]

  // Git options
  commit?: boolean | string
  tag?: boolean | string
  push?: boolean
  sign?: boolean
  noGitCheck?: boolean
  noVerify?: boolean

  // Execution options
  install?: boolean
  ignoreScripts?: boolean
  execute?: string | string[]

  // UI options
  confirm?: boolean
  quiet?: boolean
  ci?: boolean
  progress?: ProgressCallback

  // Advanced options
  all?: boolean
  recursive?: boolean
  printCommits?: boolean
}

export interface BumpxConfig extends VersionBumpOptions {
  // Default configuration
}

export type BumpxOptions = Partial<BumpxConfig>

export enum ProgressEvent {
  FileUpdated = 'fileUpdated',
  FileSkipped = 'fileSkipped',
  GitCommit = 'gitCommit',
  GitTag = 'gitTag',
  GitPush = 'gitPush',
  NpmScript = 'npmScript',
  Execute = 'execute',
}

export interface VersionBumpProgress {
  event: ProgressEvent
  script?: string
  updatedFiles: string[]
  skippedFiles: string[]
  newVersion: string
  oldVersion?: string
}

export type ProgressCallback = (progress: VersionBumpProgress) => void

export interface ParsedArgs {
  help?: boolean
  version?: boolean
  quiet?: boolean
  command?: string
  files?: string[]
  latest?: boolean
  options: VersionBumpOptions
}

export interface PackageJson {
  name?: string
  version: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: any
}

export interface FileInfo {
  path: string
  content: string
  updated: boolean
  oldVersion?: string
  newVersion?: string
}

export enum ExitCode {
  Success = 0,
  InvalidArgument = 1,
  FatalError = 2,
}
