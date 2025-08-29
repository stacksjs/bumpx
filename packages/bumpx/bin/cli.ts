#!/usr/bin/env node
import type { BumpxConfig, VersionBumpProgress } from '../src/types'
import process from 'node:process'
import { CLI } from '@stacksjs/clapp'
import { version } from '../package.json'
import { defaultConfig as bumpConfigDefaults, loadBumpConfig } from '../src/config'
import { ExitCode, ProgressEvent } from '../src/types'
import { colors, isReleaseType, isValidVersion, symbols } from '../src/utils'
import { versionBump } from '../src/version-bump'

const cli = new CLI('bumpx')

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
  forceUpdate?: boolean
}

/**
 * Progress callback for CLI output
 */
function progress({ event, script, updatedFiles, skippedFiles, newVersion }: VersionBumpProgress): void {
  switch (event) {
    case ProgressEvent.FileUpdated:
      console.log(colors.gray(`${symbols.success} Updated ${updatedFiles[updatedFiles.length - 1]} to ${newVersion}`))
      break

    case ProgressEvent.FileSkipped:
      console.log(colors.gray(`${symbols.info} ${skippedFiles[skippedFiles.length - 1]} did not need to be updated`))
      break

    case ProgressEvent.GitCommit:
      console.log(colors.gray(`${symbols.success} Git commit`))
      break

    case ProgressEvent.GitTag:
      console.log(colors.gray(`${symbols.success} Git tag`))
      break

    case ProgressEvent.GitPush:
      console.log(colors.gray(`${symbols.success} Git push`))
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
    || message.includes('working tree is not clean')
    || message.includes('Unknown option')) {
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
  if (options.yes !== undefined) {
    cliOverrides.confirm = !options.yes
    // If --yes is used and commit/tag operations are enabled, skip git checks for smoother workflow
    if (options.yes && (cliOverrides.commit !== false || (cliOverrides.commit === undefined && bumpConfigDefaults.commit))) {
      cliOverrides.noGitCheck = true
    }
  }
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
  if (options.forceUpdate !== undefined)
    cliOverrides.forceUpdate = options.forceUpdate

  const loaded = await loadBumpConfig({
    ...cliOverrides,
    ...ciOverrides,
  })

  // If no release and no files were provided, default to a safe 'patch' release
  if (!loaded.release && (!files || files.length === 0)) {
    loaded.release = 'patch'
  }

  return loaded
}

// Main version bump command (default)
cli
  .command('[release] [...files]', 'Bump version of package.json files')
  .option('--preid <preid>', 'ID for prerelease')
  .option('--all', `Include all files (default: ${bumpConfigDefaults.all})`)
  .option('--no-git-check, --git-check, --gitCheck', 'Toggle git check')
  .option('-c, --commit', 'Create git commit')
  .option('--commit-message <msg>', 'Custom commit message')
  .option('-t, --tag', 'Create git tag')
  .option('--tag-name <name>', 'Custom tag name')
  .option('--tag-message <message>', 'Tag message')
  .option('--sign', 'Sign commit and tag')
  .option('--install', 'Run \'npm install\' after bumping version')
  .option('-p, --push', `Push to remote (default: ${bumpConfigDefaults.push})`)
  .option('--no-push', 'Skip pushing to remote')
  .option('-r, --recursive', `Update all packages in the workspace (default: ${bumpConfigDefaults.recursive})`)
  .option('--no-recursive', 'Disable recursive package updates')
  .option('-y, --yes', `Skip confirmation (default: ${!bumpConfigDefaults.confirm})`)
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
  .option('--force-update', 'Force update even if version is the same')
  .example('bumpx patch')
  .example('bumpx minor --no-git-check')
  .example('bumpx major --no-push')
  .example('bumpx 1.2.3')
  .example('bumpx --recursive')
  .action(async (release: string | undefined, files: string[] | undefined, options: CLIOptions) => {
    try {
      // Validate release type before proceeding
      if (release && !isReleaseType(release) && !isValidVersion(release) && release !== 'prompt') {
        throw new Error(`Invalid release type or version: ${release}`)
      }

      const config = await prepareConfig(release, files, options)

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
