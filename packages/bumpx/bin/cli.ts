#!/usr/bin/env node

import type { ParsedArgs, VersionBumpProgress } from '../src/types'
import process from 'node:process'
import { version } from '../package.json'
import { bumpConfigDefaults, loadBumpConfig } from '../src/config'
import { ExitCode, ProgressEvent } from '../src/types'
import { colors, isReleaseType, isValidVersion, symbols } from '../src/utils'
import { versionBump } from '../src/version-bump'

/**
 * Simple CAC-like CLI parser (avoiding dependencies)
 */
class SimpleCLI {
  private commands: Map<string, any> = new Map()
  private globalOptions: any = {}
  private program = {
    name: 'bumpx',
    version,
  }

  command(name: string, description: string) {
    const cmd = {
      name,
      description,
      options: new Map(),
      action: null as any,
      examples: [] as string[],
    }
    this.commands.set(name, cmd)
    return {
      option: (flags: string, description: string, config?: any) => {
        cmd.options.set(flags, { description, config })
        return this
      },
      example: (example: string) => {
        cmd.examples.push(example)
        return this
      },
      action: (fn: any) => {
        cmd.action = fn
        return this
      },
    }
  }

  option(flags: string, description: string, config?: any) {
    this.globalOptions[flags] = { description, config }
    return this
  }

  version(v: string) {
    this.program.version = v
    return this
  }

  help() {
    console.log(`\n${this.program.name} v${this.program.version}`)
    console.log('\nUsage:')
    console.log(`  ${this.program.name} [options] [release]`)
    console.log(`  ${this.program.name} [release] [...files]`)
    console.log('\nOptions:')

    Object.entries(this.globalOptions).forEach(([flags, info]: [string, any]) => {
      console.log(`  ${flags.padEnd(20)} ${info.description}`)
    })

    console.log('\nExamples:')
    console.log('  bumpx patch')
    console.log('  bumpx minor --no-git-check')
    console.log('  bumpx major --no-push')
    console.log('  bumpx 1.2.3')
    console.log('  bumpx --recursive')
    console.log('')
    return this
  }

  parse(argv = process.argv) {
    const args = argv.slice(2)
    const options: any = {}
    const files: string[] = []
    let release: string | undefined

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      if (arg === '--help' || arg === '-h') {
        this.help()
        process.exit(0)
      }

      if (arg === '--version' || arg === '-v') {
        console.log(this.program.version)
        process.exit(0)
      }

      if (arg.startsWith('--')) {
        const key = arg.slice(2)
        if (key.startsWith('no-')) {
          const realKey = key.slice(3).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
          options[realKey] = false
        }
        else {
          const realKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            options[realKey] = args[++i]
          }
          else {
            options[realKey] = true
          }
        }
      }
      else if (arg.startsWith('-')) {
        const flags = arg.slice(1)
        for (const flag of flags) {
          switch (flag) {
            case 'c':
              options.commit = true
              break
            case 't':
              options.tag = true
              break
            case 'p':
              options.push = true
              break
            case 'y':
              options.yes = true
              break
            case 'r':
              options.recursive = true
              break
            case 'q':
              options.quiet = true
              break
            case 'x':
              if (i + 1 < args.length) {
                options.execute = args[++i]
              }
              break
          }
        }
      }
      else {
        // Positional argument
        if (!release && (isReleaseType(arg) || isValidVersion(arg) || arg === 'prompt')) {
          release = arg
        }
        else {
          files.push(arg)
        }
      }
    }

    return { options, files, release }
  }
}

/**
 * Parse command line arguments
 */
async function parseArgs(): Promise<ParsedArgs> {
  try {
    const cli = new SimpleCLI()

    cli
      .version(version)
      .option('--preid <preid>', 'ID for prerelease')
      .option('--all', `Include all files (default: ${bumpConfigDefaults.all})`)
      .option('--no-git-check', `Skip git check`)
      .option('-c, --commit [msg]', 'Commit message', { default: true })
      .option('--no-commit', 'Skip commit')
      .option('-t, --tag [tag]', 'Tag name', { default: true })
      .option('--no-tag', 'Skip tag')
      .option('--sign', 'Sign commit and tag')
      .option('--install', `Run 'npm install' after bumping version`)
      .option('-p, --push', `Push to remote (default: ${bumpConfigDefaults.push})`)
      .option('-y, --yes', `Skip confirmation (default: ${!bumpConfigDefaults.confirm})`)
      .option('-r, --recursive', `Bump package.json files recursively`)
      .option('--no-verify', 'Skip git verification')
      .option('--ignore-scripts', `Ignore scripts`)
      .option('-q, --quiet', 'Quiet mode')
      .option('--ci', 'CI mode (non-interactive, sets --yes --quiet --no-git-check)')
      .option('--current-version <version>', 'Current version')
      .option('--print-commits', 'Print recent commits')
      .option('-x, --execute <command>', 'Commands to execute after version bumps')

    const { options: args, files, release } = cli.parse()

    // Handle CI mode - override other settings for non-interactive operation
    const isCiMode = args.ci || process.env.CI === 'true'
    const ciOverrides = isCiMode
      ? {
          confirm: false, // Skip confirmation in CI
          quiet: true, // Reduce output in CI
          noGitCheck: false, // Keep git check in CI for safety
        }
      : {}

    const options = await loadBumpConfig({
      preid: args.preid,
      commit: args.commit !== undefined ? args.commit : undefined,
      tag: args.tag !== undefined ? args.tag : undefined,
      sign: args.sign,
      push: args.push,
      all: args.all,
      noGitCheck: args.noGitCheck,
      confirm: !args.yes,
      noVerify: !args.verify,
      install: args.install,
      files,
      ignoreScripts: args.ignoreScripts,
      currentVersion: args.currentVersion,
      execute: args.execute,
      printCommits: args.printCommits,
      recursive: args.recursive,
      quiet: args.quiet,
      ci: isCiMode,
      release,
      ...ciOverrides,
    })

    return {
      help: args.help,
      version: args.version,
      quiet: args.quiet,
      options,
    }
  }
  catch (error) {
    console.error(`Error parsing arguments: ${error}`)
    process.exit(ExitCode.InvalidArgument)
  }
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
  process.exit(ExitCode.FatalError)
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    // Setup global error handlers
    process.on('uncaughtException', errorHandler)
    process.on('unhandledRejection', errorHandler)

    // Parse command-line arguments
    const { help, version: showVersion, quiet, options } = await parseArgs()

    if (help || showVersion) {
      // Will be handled by CLI parser
      process.exit(ExitCode.Success)
    }
    else {
      if (!options.all && !options.noGitCheck) {
        await checkGitStatus()
      }

      if (!quiet) {
        options.progress = options.progress || progress
      }

      await versionBump(options)
    }
  }
  catch (error) {
    errorHandler(error as Error)
  }
}

// Run the CLI
main().catch(errorHandler)
