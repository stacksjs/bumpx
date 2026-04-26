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
  /**
   * In recursive (workspace) mode, only bump packages whose source has
   * changed since the given git ref. Set to `true` to use the latest
   * `v*.*.*` tag, or pass an explicit ref ("v0.2.20", "main", a SHA).
   *
   * The root package.json is always bumped — it represents the release
   * itself, not a publishable package.
   *
   * Useful for monorepos with hundreds of leaf packages (icon
   * collections, language data, etc.) that rarely change but currently
   * get republished on every release. Pairs with pantry's
   * skip-if-already-published precheck: skipped here means no version
   * change, so pantry's GET-precheck short-circuits the publish too.
   */
  onlyChangedSince?: boolean | string
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
}

export interface VersionBumpProgress {
  event: ProgressEvent
  script?: string
  updatedFiles: string[]
  skippedFiles: string[]
  newVersion: string
  oldVersion?: string
}

export type ProgressCallback = (_progress: VersionBumpProgress) => void

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
