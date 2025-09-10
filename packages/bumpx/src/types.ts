export type ReleaseType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'

export interface VersionBumpOptions {
  release?: ReleaseType | string
  files?: string[]
  recursive?: boolean
  commit?: boolean | string
  tag?: boolean | string
  push?: boolean
  yes?: boolean
  dryRun?: boolean
  noGitCheck?: boolean
  preid?: string
  currentVersion?: string
  execute?: string | string[]
  install?: boolean
  printCommits?: boolean
  ci?: boolean
  cwd?: string
  progress?: ProgressCallback
  forceUpdate?: boolean
  quiet?: boolean
  tagMessage?: string
  sign?: boolean
  confirm?: boolean
  all?: boolean
  noVerify?: boolean
  ignoreScripts?: boolean
  changelog?: boolean
  respectGitignore?: boolean
  verbose?: boolean
  createGitHubRelease?: boolean
  githubToken?: string
  githubReleaseOptions?: GitHubReleaseOptions
}

export interface BumpxConfig extends VersionBumpOptions {
  // Default configuration
  all?: boolean
  confirm?: boolean
  noVerify?: boolean
  ignoreScripts?: boolean
  quiet?: boolean
  verbose?: boolean
  sign?: boolean
  tagMessage?: string
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
  ChangelogGenerated = 'changelogGenerated',
  GitHubRelease = 'githubRelease',
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
  options: VersionBumpOptions
}

export interface PackageJson {
  name?: string
  version: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  workspaces?: string[] | { packages: string[] }
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

export interface WorkspaceInfo {
  name: string
  version: string
  path: string
  packageJson: PackageJson
  isPrivate?: boolean
}

export interface WorkspaceConfig {
  packages: string[]
  nohoist?: string[]
}

export interface MonorepoInfo {
  isMonorepo: boolean
  workspaceRoot?: string
  packages: WorkspaceInfo[]
  workspaceConfig?: WorkspaceConfig
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
}

export interface GitHubReleaseOptions {
  /**
   * Owner of the GitHub repository
   */
  owner?: string

  /**
   * Name of the GitHub repository
   */
  repo?: string

  /**
   * Whether to mark the release as a draft (unpublished)
   */
  draft?: boolean

  /**
   * Whether to mark the release as a prerelease
   */
  prerelease?: boolean

  /**
   * Whether to generate release notes automatically using GitHub's API
   */
  generateReleaseNotes?: boolean

  /**
   * Custom release title. If not provided, the tag name will be used
   */
  name?: string

  /**
   * Custom release body content. If not provided and generateReleaseNotes is false,
   * content from CHANGELOG.md will be used
   */
  body?: string
}
