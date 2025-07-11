import type { BumpxConfig, VersionBumpProgress } from '../src/types'
import process from 'node:process'
import { CAC } from 'cac'
import { version } from '../package.json'
import { defaultConfig as bumpConfigDefaults, loadBumpConfig } from '../src/config'
import { ExitCode, ProgressEvent } from '../src/types'
import { colors, isReleaseType, isValidVersion, symbols } from '../src/utils'
import { versionBump } from '../src/version-bump'

const cli = new CAC('bumpx')

// Define CLI options interface to match CAC's naming conventions
interface CLIOptions {
  preid?: string
  all?: boolean
  gitCheck?: boolean
  commit?: boolean
  commitMessage?: string
  tag?: boolean
  tagName?: string
  tagMessage?: string
  sign?: boolean
  install?: boolean
  push?: boolean
  yes?: boolean
  recursive?: boolean
  verify?: boolean
  ignoreScripts?: boolean
  quiet?: boolean
  dryRun?: boolean
  ci?: boolean
  currentVersion?: string
  printCommits?: boolean
  execute?: string
  files?: string
  verbose?: boolean
}

/**
 * Progress callback for CLI output
 */
function progress({ event, script, updatedFiles, skippedFiles, newVersion }: VersionBumpProgress): void {
  switch (event) {
    case ProgressEvent.FileUpdated:
      console.log(colors.green(`${symbols.success} Updated ${updatedFiles[updatedFiles.length - 1]} to ${newVersion}`))
      break

    case ProgressEvent.FileSkipped:
      console.log(colors.gray(`${symbols.info} ${skippedFiles[skippedFiles.length - 1]} did not need to be updated`))
      break

    case ProgressEvent.GitCommit:
      console.log(colors.green(`${symbols.success} Git commit`))
      break

    case ProgressEvent.GitTag:
      console.log(colors.green(`${symbols.success} Git tag`))
      break

    case ProgressEvent.GitPush:
      console.log(colors.green(`${symbols.success} Git push`))
      break

    case ProgressEvent.NpmScript:
      console.log(colors.green(`${symbols.success} Npm run ${script}`))
      break

    case ProgressEvent.Execute:
      console.log(colors.green(`${symbols.success} Execute ${script}`))
      break
  }
}

/**
 * Check git status
 */
async function checkGitStatus() {
  const { executeGit } = await import('../src/utils')
  const status = executeGit(['status', '--porcelain'])
  if (status.trim()) {
    throw new Error(`Git working tree is not clean:\n${status}`)
  }
}

/**
 * Error handler
 */
function errorHandler(error: Error): never {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
    message += `\n\n${error.stack || ''}`
  }

  console.error(colors.red(`${symbols.error} ${message}`))

  // Use more specific exit codes based on error type
  if (message.includes('No package.json files found')
    || message.includes('Failed to read')
    || message.includes('Invalid release type')
    || message.includes('invalid command')
    || message.includes('Invalid')
    || message.includes('Release type or version must be specified')
    || message.includes('Could not determine')
    || message.includes('working tree is not clean')) {
    process.exit(ExitCode.InvalidArgument)
  }

  process.exit(ExitCode.FatalError)
}

/**
 * Parse and prepare config from CLI options
 */
async function prepareConfig(release: string | undefined, files: string[] | undefined, options: CLIOptions): Promise<BumpxConfig> {
  // Handle CI mode - override other settings for non-interactive operation
  const isCiMode = options.ci || process.env.CI === 'true'
  const ciOverrides = isCiMode
    ? {
        confirm: false, // Skip confirmation in CI
        quiet: true, // Reduce output in CI
      }
    : {}

  // Handle --files flag which can be comma-separated
  let finalFiles = files
  if (options.files) {
    finalFiles = options.files.split(',').map((f: string) => f.trim())
  }

  // Only pass CLI arguments that were explicitly provided, let config file fill in the rest
  const cliOverrides: Partial<BumpxConfig> = {}

  if (options.preid !== undefined)
    cliOverrides.preid = options.preid
  if (options.commit !== undefined)
    cliOverrides.commit = options.commit
  if (options.commitMessage !== undefined)
    cliOverrides.commit = options.commitMessage
  if (options.tag !== undefined)
    cliOverrides.tag = options.tag
  if (options.tagName !== undefined)
    cliOverrides.tag = options.tagName
  if (options.tagMessage !== undefined)
    cliOverrides.tagMessage = options.tagMessage
  if (options.sign !== undefined)
    cliOverrides.sign = options.sign
  if (options.push !== undefined)
    cliOverrides.push = options.push
  if (options.all !== undefined)
    cliOverrides.all = options.all
  if (options.gitCheck === false) {
    cliOverrides.noGitCheck = true
    // When --no-git-check is used, disable all git operations
    cliOverrides.commit = false
    cliOverrides.tag = false
    cliOverrides.push = false
  }
  if (options.yes !== undefined)
    cliOverrides.confirm = !options.yes
  if (options.verify === false)
    cliOverrides.noVerify = true
  if (options.install !== undefined)
    cliOverrides.install = options.install
  if (finalFiles !== undefined)
    cliOverrides.files = finalFiles
  if (options.ignoreScripts !== undefined)
    cliOverrides.ignoreScripts = options.ignoreScripts
  if (options.currentVersion !== undefined)
    cliOverrides.currentVersion = options.currentVersion
  if (options.execute !== undefined)
    cliOverrides.execute = options.execute
  if (options.printCommits !== undefined)
    cliOverrides.printCommits = options.printCommits
  if (options.recursive !== undefined)
    cliOverrides.recursive = options.recursive
  if (options.quiet !== undefined)
    cliOverrides.quiet = options.quiet
  if (options.dryRun !== undefined)
    cliOverrides.dryRun = options.dryRun
  if (options.verbose !== undefined)
    cliOverrides.verbose = options.verbose
  if (isCiMode)
    cliOverrides.ci = true
  if (release !== undefined)
    cliOverrides.release = release

  return await loadBumpConfig({
    ...cliOverrides,
    ...ciOverrides,
  })
}

// Main version bump command (default)
cli
  .command('[release] [...files]', 'Bump version of package.json files')
  .option('--preid <preid>', 'ID for prerelease')
  .option('--all', `Include all files (default: ${bumpConfigDefaults.all})`)
  .option('--no-git-check', 'Skip git check')
  .option('-c, --commit', 'Create git commit')
  .option('--commit-message <msg>', 'Custom commit message')
  .option('-t, --tag', 'Create git tag')
  .option('--tag-name <name>', 'Custom tag name')
  .option('--tag-message <message>', 'Tag message')
  .option('--sign', 'Sign commit and tag')
  .option('--install', 'Run \'npm install\' after bumping version')
  .option('-p, --push', `Push to remote (default: ${bumpConfigDefaults.push})`)
  .option('-y, --yes', `Skip confirmation (default: ${!bumpConfigDefaults.confirm})`)
  .option('-r, --recursive', 'Bump package.json files recursively')
  .option('--no-verify', 'Skip git verification')
  .option('--ignore-scripts', 'Ignore scripts')
  .option('-q, --quiet', 'Quiet mode')
  .option('--dry-run', 'Show what would be changed without making changes')
  .option('--ci', 'CI mode (non-interactive, sets --yes --quiet --no-git-check)')
  .option('--current-version <version>', 'Current version')
  .option('--print-commits', 'Print recent commits')
  .option('-x, --execute <command>', 'Commands to execute after version bumps')
  .option('--files <files>', 'Comma-separated list of files to update')
  .option('--verbose', 'Enable verbose output')
  .example('bumpx patch')
  .example('bumpx minor --no-git-check')
  .example('bumpx major --no-push')
  .example('bumpx 1.2.3')
  .example('bumpx --recursive')
  .action(async (release: string | undefined, files: string[] | undefined, options: CLIOptions) => {
    try {
      if (!release && (!files || files.length === 0)) {
        // No release type and no files specified - show help
        cli.outputHelp()
        process.exit(ExitCode.Success)
      }

      // Validate release type before proceeding
      if (release && !isReleaseType(release) && !isValidVersion(release) && release !== 'prompt') {
        throw new Error(`Invalid release type or version: ${release}`)
      }

      const config = await prepareConfig(release, files, options)

      if (!config.noGitCheck) {
        await checkGitStatus()
      }

      if (!options.quiet) {
        config.progress = config.progress || progress
      }

      await versionBump(config)
    }
    catch (error) {
      errorHandler(error as Error)
    }
  })

// Version command
cli
  .command('version', 'Show the version of bumpx')
  .action(() => {
    console.log(version)
  })

// Setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

cli.version(version)
cli.help()
cli.parse()
