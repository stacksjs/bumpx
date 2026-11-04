#!/usr/bin/env node
import type { BumpxConfig, VersionBumpProgress } from '../src/types'
import process from 'node:process'
import { CLI } from '@stacksjs/clapp'
import { version } from '../package.json'
import { defaultConfig as bumpConfigDefaults, loadBumpConfig } from '../src/config'
import { checkInterruption, userInterrupted } from '../src/interrupt'
import { ExitCode, ProgressEvent } from '../src/types'
import { colors, isCiEnvironment, isReleaseType, isValidVersion, symbols } from '../src/utils'
import { versionBump } from '../src/version-bump'

// Handle SIGINT (Ctrl+C) globally
process.on('SIGINT', () => {
  userInterrupted.value = true
  // Use stderr.write to ensure message is displayed even during process exit
  process.stderr.write('\nOperation cancelled by user \x1B[3m(Ctrl+C)\x1B[0m\n')
  // Exit with success code - this was an intentional cancellation
  process.exit(0)
})

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
  expectedSource?: string
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
  changelog?: boolean
  respectGitignore?: boolean
  onlyChangedSince?: boolean | string
  interaction?: boolean
}

/**
 * Whether there is anybody to answer a prompt.
 *
 * Four ways to say no, and bumpx used to honour none of them: stdin is not a
 * terminal (a CI job, a pipe, `< /dev/null`), the environment announces itself
 * as CI, or the invocation asked for non-interactive behaviour with `--ci`,
 * `--yes` or `--no-interaction`. Rendering a picker into a log that nobody can
 * answer blocks until the job's timeout kills it, with nothing in the output
 * to explain why.
 */
function canPrompt(options: CLIOptions): boolean {
  if (options.ci || options.yes || options.interaction === false)
    return false
  if (isCiEnvironment())
    return false
  return Boolean(process.stdin.isTTY)
}

/**
 * Name the reason there is nobody to ask, so the error says which of the four
 * applies rather than leaving the user to guess which one bumpx noticed.
 */
function describeNonInteractive(options: CLIOptions): string {
  if (options.ci)
    return '--ci is non-interactive'
  if (options.yes)
    return '--yes asked for no prompts'
  if (options.interaction === false)
    return '--no-interaction was passed'
  if (isCiEnvironment())
    return 'CI is set in the environment'
  return 'stdin is not a TTY'
}

/**
 * Progress callback for CLI output
 */
function progress({ event, script, updatedFiles, skippedFiles, newVersion }: VersionBumpProgress, verbose: boolean = false): void {
  switch (event) {
    case ProgressEvent.FileUpdated:
      // Only show individual file updates in verbose mode
      if (verbose) {
        console.log(colors.gray(`🔎 ${symbols.checkmark} Updated ${updatedFiles[updatedFiles.length - 1]} to ${newVersion}`))
      }
      break

    case ProgressEvent.FileSkipped:
      // Only show individual file skips in verbose mode
      if (verbose) {
        console.log(colors.gray(`🔎 ${symbols.info} ${skippedFiles[skippedFiles.length - 1]} did not need to be updated`))
      }
      break

    case ProgressEvent.GitCommit:
      if (verbose) {
        console.log(colors.gray(`🔎 ${symbols.checkmark} Git commit`))
      }
      break

    case ProgressEvent.GitTag:
      if (verbose) {
        console.log(colors.gray(`🔎 ${symbols.checkmark} Git tag`))
      }
      break

    case ProgressEvent.GitPush:
      if (verbose) {
        console.log(colors.gray(`🔎 ${symbols.checkmark} Git push`))
      }
      break

    case ProgressEvent.NpmScript:
      console.log(colors.green(`${symbols.checkmark} Npm run ${script}`))
      break

    case ProgressEvent.Execute:
      if (verbose) {
        console.log(colors.gray(`🔎 ${symbols.checkmark} Execute ${script}`))
      }
      break

    case ProgressEvent.ChangelogGenerated:
      if (verbose) {
        console.log(colors.gray(`🔎 ${symbols.checkmark} Generated changelog`))
      }
      break
  }
}

/**
 * Prompt user for confirmation when using -r --all
 */
async function promptForRecursiveAll(options: CLIOptions): Promise<boolean> {
  // Check for interruption before prompting
  checkInterruption()

  // Prevent prompting during tests to avoid hanging
  if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test' || process.argv.includes('test')) {
    return true // Auto-confirm in test mode
  }

  // Nobody is there to answer. Refusing beats blocking on a confirmation
  // prompt until the step times out.
  if (!canPrompt(options)) {
    console.error(colors.red(`${symbols.error} --recursive --all needs confirmation, but ${describeNonInteractive(options)}.`))
    console.error(colors.gray('Pass --yes to confirm non-interactively.'))
    return false
  }

  try {
    // Dynamic import to avoid top-level import issues
    const clappModule: any = await import('@stacksjs/clapp')
    const confirm = clappModule.confirm || clappModule.default?.confirm || clappModule.CLI?.confirm

    if (!confirm) {
      throw new Error('Unable to import confirmation prompt from @stacksjs/clapp')
    }

    console.log('\n⚠️ You are about to recursively update ALL packages in the workspace.')
    console.log('This will commit, tag, and push the changes to the remote repository.')

    const shouldProceed = await confirm({
      message: 'Do you want to continue?',
      initial: false,
    })

    return shouldProceed
  }
  catch (error: any) {
    // Check if this is a cancellation/interruption
    if (error.message?.includes('cancelled')
      || error.message?.includes('interrupted')
      || error.message?.includes('SIGINT')
      || error.message?.includes('SIGTERM')) {
      return false
    }

    // For other errors, default to not proceeding for safety
    console.warn('Warning: Interactive prompt failed, defaulting to cancel for safety')
    return false
  }
}

/**
 * Shown alongside an argument error, so somebody who mistyped or forgot the
 * release type gets the fix in the same output as the complaint.
 */
const releaseUsage = [
  'Release types: patch | minor | major | prepatch | preminor | premajor | prerelease | pre | build | release',
  'Or an exact version: bumpx 1.2.3',
  'Run `bumpx --help` for every option.',
].join('\n')

/**
 * Report a bad invocation and exit.
 *
 * Argument validation is settled before any work starts, so it is reported
 * here instead of thrown. A throw travels back out through the runtime's error
 * reporter, which prints a code frame from the bundled dist — and a bundle
 * holds ~20 KB lines, so six lines of context around a one-line user mistake
 * arrive as tens of kilobytes of JavaScript that scroll the actual message off
 * the screen. Nothing about a forgotten release type is a stack trace.
 */
function fail(message: string, hint?: string): never {
  console.error(colors.red(`${symbols.error} ${message}`))
  if (hint)
    console.error(colors.gray(hint))
  process.exit(ExitCode.InvalidArgument)
}

/**
 * Messages that describe something the user typed, rather than something that
 * went wrong inside bumpx. They exit 1, and they are reported as plainly as
 * `fail()` reports the ones caught earlier.
 */
const userErrorPatterns = [
  'No package.json files found',
  'Failed to read',
  'Invalid release type',
  'invalid command',
  'Invalid',
  'Release type or version must be specified',
  'Could not determine',
  'working tree is not clean',
  'Git working tree is not clean',
  'Git command failed: git status',
  'Unknown option',
]

/**
 * Error handler
 *
 * `context` names the handler that caught it. It is printed only for errors
 * that are genuinely unexpected: an unknown option arrives here as a rejected
 * promise from the argument parser, and announcing "Unhandled Rejection" above
 * a typo makes a mistyped flag read like a crash in bumpx.
 */
function errorHandler(error: Error, context?: string): never {
  let message = error.message || String(error)

  // Prevent duplicate error handling
  // This happens when errors get caught and re-thrown
  const handledSymbol = Symbol.for('bumpx.errorHandled')
  if ((error as any)[handledSymbol]) {
    process.exit(ExitCode.FatalError)
  }
  (error as any)[handledSymbol] = true

  // Handle cancellation and user interruption gracefully
  if (message === 'Version bump cancelled by user'
    || message === 'Operation cancelled by user') {
    // Exit cleanly for user cancellations
    process.exit(0)
  }

  // Decided from the message as thrown, before the stack is appended below:
  // a stack mentioning, say, an `Invalid` identifier is not a user error.
  const userError = userErrorPatterns.some(pattern => message.includes(pattern))

  if (context && !userError)
    console.error(`${context}:`)

  // Full error details, including the stack, are for CI and debugging only
  const debugging = Boolean(process.env.CI || process.env.DEBUG || process.env.NODE_ENV === 'development')

  // Avoid duplicating error messages if the message already contains the error
  // symbol, or if whatever threw it already printed the same line itself —
  // version-bump reports the errors it rethrows so library callers see them,
  // which would otherwise put the same sentence on screen twice here.
  const reportedSymbol = Symbol.for('bumpx.errorReported')
  const alreadyPrinted = message.includes(symbols.error) || Boolean((error as any)[reportedSymbol])

  if (debugging) {
    message += `\n\n${error.stack || ''}`
  }

  if (!alreadyPrinted) {
    console.error(colors.red(`${symbols.error} ${message}`))
  }
  else if (debugging && error.stack) {
    console.error(error.stack)
  }

  // Use more specific exit codes based on error type
  process.exit(userError ? ExitCode.InvalidArgument : ExitCode.FatalError)
}

/**
 * Parse and prepare config from CLI options
 */
async function prepareConfig(release: string | undefined, files: string[] | undefined, options: CLIOptions): Promise<BumpxConfig> {
  // Check for interruption before starting
  checkInterruption()

  // Handle CI mode - override other settings for non-interactive operation
  const isCiMode = options.ci || process.env.CI === 'true'
  const ciOverrides = isCiMode
    ? {
        confirm: false, // Skip confirmation in CI
        quiet: true, // Reduce output in CI
      }
    : {}

  // Handle --files flag (comma-separated). Entries may be literal paths
  // OR globs (`packages/*/package.json`, `./**/package.json`); expand the
  // globs here using Bun.Glob so users don't need to rely on shell globbing,
  // which gets dropped when bumpx is invoked through layers like buddy
  // → runCommand. Literal paths fall through unchanged.
  let finalFiles = files
  //
  // Dedupe by absolute path so `./package.json` + `./**/package.json` don't
  // double-update the same file (bumpx applies the bump per match, so a
  // duplicate match would bump 0.1.0 → 0.1.2 instead of 0.1.1).
  //
  // Skip the well-known noise directories (node_modules, dist, pantry, …)
  // so a `**/package.json` glob doesn't crawl into transitive deps and bump
  // typescript's vendored package.json to a new major.
  if (options.files) {
    const { resolve: resolvePath } = await import('node:path')
    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/pantry/**',
      '**/.git/**',
      '**/.bun-cache/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.zig-cache/**',
      '**/zig-out/**',
    ]
    const isIgnored = (path: string): boolean => {
      const normalized = path.replace(/\\/g, '/')
      return ignorePatterns.some((p) => {
        // Cheap prefix-segment check — every pattern is `**/<dir>/**`, so
        // any path containing `/<dir>/` (or starting with `<dir>/`) matches.
        const segment = p.replace(/^\*\*\//, '/').replace(/\/\*\*$/, '/')
        return normalized.includes(segment) || normalized.startsWith(segment.slice(1))
      })
    }

    const entries = options.files.split(',').map((f: string) => f.trim()).filter(Boolean)
    const expanded = new Set<string>()
    const cwd = process.cwd()
    for (const entry of entries) {
      if (entry.includes('*') || entry.includes('?') || entry.includes('[') || entry.includes('{')) {
        try {
          // Strip a leading ./ so Bun.Glob's relative-to-cwd matching works
          // identically to how the shell would have expanded it.
          const pattern = entry.replace(/^\.\//, '')
          const glob = new Bun.Glob(pattern)
          let matched = 0
          for (const match of glob.scanSync({ cwd, onlyFiles: true, dot: false })) {
            if (isIgnored(match)) continue
            expanded.add(resolvePath(cwd, match))
            matched++
          }
          if (matched === 0 && options.verbose) {
            console.warn(colors.yellow(`${symbols.warning} No files matched glob: ${entry}`))
          }
        }
        catch (err) {
          console.warn(colors.yellow(`${symbols.warning} Failed to expand glob "${entry}": ${(err as Error).message}`))
        }
      }
      else {
        expanded.add(resolvePath(cwd, entry))
      }
    }
    finalFiles = Array.from(expanded)
  }

  // Check for -r --all combination that requires special prompting
  const isRecursiveAll = options.recursive && options.all

  // Only pass CLI arguments that were explicitly provided, let config file fill in the rest
  const cliOverrides: Partial<BumpxConfig> = {}

  if (options.preid !== undefined)
    cliOverrides.preid = options.preid
  // Only override boolean flags when explicitly set to true, allowing defaults to work
  if (options.commit === true)
    cliOverrides.commit = true
  if (options.commit === false)
    cliOverrides.commit = false
  if (options.commitMessage !== undefined)
    cliOverrides.commit = options.commitMessage
  if (options.tag === true)
    cliOverrides.tag = true
  if (options.tag === false)
    cliOverrides.tag = false
  if (options.tagName !== undefined)
    cliOverrides.tag = options.tagName
  if (options.tagMessage !== undefined)
    cliOverrides.tagMessage = options.tagMessage
  if (options.expectedSource !== undefined)
    cliOverrides.expectedSource = options.expectedSource
  if (options.sign === true)
    cliOverrides.sign = true
  if (options.push === true)
    cliOverrides.push = true
  if (options.push === false)
    cliOverrides.push = false
  if (options.all !== undefined)
    cliOverrides.all = options.all
  if (options.gitCheck === false) {
    cliOverrides.noGitCheck = true
    // --no-git-check only skips git status checks, not git operations
  }
  if (options.yes !== undefined) {
    // `--yes` answers prompts. It does NOT waive the clean-tree check.
    //
    // It used to set `noGitCheck` as well, "for smoother workflow" — and since
    // every release script in this org is `bumpx <bump> --recursive --yes`,
    // that meant the check effectively did not exist. A release could be cut
    // from a tree with modified tracked files, producing a tag whose contents
    // are not what anyone built or tested, and leaving the release commit
    // sitting on top of unrelated work-in-progress.
    //
    // Not prompting and not checking are different things. `--no-git-check` is
    // still there for anyone who genuinely wants the second one.
    cliOverrides.confirm = !options.yes
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
  if (options.changelog !== undefined)
    cliOverrides.changelog = options.changelog
  if (options.respectGitignore !== undefined)
    cliOverrides.respectGitignore = options.respectGitignore
  if (options.onlyChangedSince !== undefined)
    cliOverrides.onlyChangedSince = options.onlyChangedSince

  // Check for interruption before loading config
  checkInterruption()

  const loaded = await loadBumpConfig({
    ...cliOverrides,
    ...ciOverrides,
  })

  // Check again after loading config
  checkInterruption()

  // `printCommits` defaults to true, and --ci — or CI in the environment —
  // forces quiet, so a quiet release printed a commit listing and nothing
  // else. Drop the default there. An explicit --print-commits is a request
  // rather than a default, and still prints: this is the one place that can
  // tell the two apart, which is why the decision lives here and not in
  // versionBump.
  if (options.printCommits === undefined && loaded.quiet)
    loaded.printCommits = false

  // If no release was provided, always show the prompt by default
  // This gives users the chance to choose their version type
  if (!loaded.release && (!files || files.length === 0)) {
    loaded.release = 'prompt'
  }

  // Handle -r --all combination with special prompting
  if (isRecursiveAll && loaded.confirm && !isCiMode && !options.yes) {
    const shouldProceed = await promptForRecursiveAll(options)
    if (!shouldProceed) {
      throw new Error('Operation cancelled by user')
    }
    // After confirmation, ensure commit, tag, and push are enabled
    loaded.commit = loaded.commit !== false ? true : loaded.commit
    loaded.tag = loaded.tag !== false ? true : loaded.tag
    loaded.push = loaded.push !== false ? true : loaded.push
  }

  return loaded
}

// Main version bump command (default)
cli
  .command('[release] [...files]', 'Bump versions: patch | minor | major | pre | prerelease | release | build | x.y.z')
  .option('--preid <preid>', 'ID for prerelease')
  .option('--all', `Include all files (default: ${bumpConfigDefaults.all})`)
  .option('--no-git-check, --git-check, --gitCheck', 'Toggle git check')
  .option('-c, --commit', 'Create git commit')
  .option('--no-commit', 'Skip git commit')
  .option('--commit-message <msg>', 'Custom commit message')
  .option('-t, --tag', 'Create git tag')
  .option('--no-tag', 'Skip git tag')
  .option('--tag-name <name>', 'Custom tag name')
  .option('--tag-message <message>', 'Tag message')
  .option('--expected-source <sha>', 'Require exact synchronized Git source before changing release files (or BUMPX_EXPECTED_SOURCE)')
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
  .option('--ci', 'CI mode (non-interactive, sets --yes --quiet)')
  .option('--no-interaction', 'Never prompt; fail instead of asking (implied by --ci, --yes, CI=true, or a non-TTY stdin)')
  .option('--current-version <version>', 'Current version')
  .option('--print-commits', 'Print recent commits')
  .option('-x, --execute <command>', 'Commands to execute after version bumps')
  .option('--files <files>', 'Comma-separated list of files to update')
  .option('--verbose', 'Enable verbose output')
  .option('--force-update', 'Force update even if version is the same')
  .option('--changelog', `Generate changelog (default: ${bumpConfigDefaults.changelog})`)
  .option('--no-changelog', 'Skip changelog generation')
  .option('--respect-gitignore', `Respect .gitignore when finding files (default: ${bumpConfigDefaults.respectGitignore})`)
  .option('--no-respect-gitignore', 'Ignore .gitignore when finding files')
  .option('--only-changed-since [ref]', 'In recursive mode, only bump leaf packages that changed since <ref> (defaults to latest v*.*.* tag if no ref given)')
  .example('bumpx patch')
  .example('bumpx pre --preid beta')
  .example('bumpx build')
  .example('bumpx release')
  .example('bumpx minor --no-git-check')
  .example('bumpx major --no-push')
  .example('bumpx 1.2.3')
  .example('bumpx --recursive')
  .action(async (release: string | undefined, files: string[] | undefined, options: CLIOptions) => {
    try {
      // Validate release type before proceeding
      if (release && !isReleaseType(release) && !isValidVersion(release) && release !== 'prompt') {
        fail(`Invalid release type or version: ${release}`, releaseUsage)
      }

      // Check for interruption before config preparation
      checkInterruption()
      const config = await prepareConfig(release, files, options)

      // Nothing left to resolve this from: no release type on the command line,
      // none in the config, and no prompt to fall back to. Say so here, before
      // versionBump starts synchronizing with the remote and reading manifests
      // on the way to the same conclusion.
      if (!config.release) {
        fail('Release type or version must be specified', releaseUsage)
      }

      // The release prompt is the default when no type is given. With nobody
      // to answer it, bumpx used to draw the picker anyway and block there
      // until the job's timeout killed it — including under --ci, which says
      // non-interactive, and --yes, which says stop asking. Ask for the
      // argument instead, which is the error bumpx already has for this.
      if (config.release === 'prompt' && !canPrompt(options)) {
        fail(
          `Release type or version must be specified: ${describeNonInteractive(options)}, so the release prompt cannot be answered`,
          releaseUsage,
        )
      }

      // Check for interruption after config preparation
      checkInterruption()

      if (!options.quiet) {
        // Create progress callback that respects verbose mode
        config.progress = config.progress || ((progressData: VersionBumpProgress) => {
          // Check for interruption before each progress update
          if (userInterrupted.value) {
            checkInterruption()
            return
          }
          progress(progressData, options.verbose || false)
        })
      }

      // Run the version bump with interruption checking
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
process.on('uncaughtException', (error) => {
  errorHandler(error, 'Uncaught Exception')
})
process.on('unhandledRejection', (reason) => {
  errorHandler(reason instanceof Error ? reason : new Error(String(reason)), 'Unhandled Rejection')
})

cli.version(version)
cli.help()
cli.parse()
