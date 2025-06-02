/* eslint-disable no-console */
import type { VersionBumpOptions } from './types'
import { resolve } from 'node:path'
import process from 'node:process'
import { ProgressEvent } from './types'
import {
  checkGitStatus,
  colors,
  createGitCommit,
  createGitTag,
  executeCommand,
  findPackageJsonFiles,
  getRecentCommits,
  incrementVersion,
  pushToRemote,
  readPackageJson,
  symbols,
  updateVersionInFile,
} from './utils'

/**
 * Main version bump function
 */
export async function versionBump(options: VersionBumpOptions): Promise<void> {
  const {
    release,
    preid,
    currentVersion,
    files,
    commit,
    tag,
    push,
    sign,
    noGitCheck,
    noVerify,
    install,
    ignoreScripts: _ignoreScripts,
    execute,
    progress,
    all,
    recursive,
    printCommits,
  } = options

  try {
    // Print recent commits if requested
    if (printCommits) {
      console.log(colors.blue('\nRecent commits:'))
      const commits = getRecentCommits(10)
      commits.forEach(commit => console.log(colors.gray(`  ${commit}`)))
      console.log()
    }

    // Check git status unless disabled
    if (!all && !noGitCheck) {
      checkGitStatus()
    }

    // Determine files to update
    let filesToUpdate: string[] = []

    if (files && files.length > 0) {
      filesToUpdate = files.map(file => resolve(file))
    }
    else if (recursive) {
      filesToUpdate = await findPackageJsonFiles(process.cwd(), true)
    }
    else {
      filesToUpdate = await findPackageJsonFiles(process.cwd(), false)
    }

    if (filesToUpdate.length === 0) {
      throw new Error('No package.json files found to update')
    }

    // Get current version from the first package.json if not provided
    let oldVersion = currentVersion
    if (!oldVersion) {
      const mainPackageJson = readPackageJson(filesToUpdate[0])
      oldVersion = mainPackageJson.version
    }

    if (!oldVersion) {
      throw new Error('Could not determine current version')
    }

    // Determine new version
    let newVersion: string
    if (release === 'prompt') {
      newVersion = await promptForVersion(oldVersion, preid)
    }
    else if (!release) {
      throw new Error('Release type or version must be specified')
    }
    else {
      newVersion = incrementVersion(oldVersion, release, preid)
    }

    if (!newVersion) {
      throw new Error('Could not determine new version')
    }

    console.log(colors.blue(`\nBumping version from ${colors.bold(oldVersion)} to ${colors.bold(newVersion)}\n`))

    // Update files
    const updatedFiles: string[] = []
    const skippedFiles: string[] = []

    for (const filePath of filesToUpdate) {
      const fileInfo = updateVersionInFile(filePath, oldVersion, newVersion)

      if (fileInfo.updated) {
        updatedFiles.push(filePath)
        if (progress) {
          progress({
            event: ProgressEvent.FileUpdated,
            updatedFiles: [filePath],
            skippedFiles: [],
            newVersion,
            oldVersion,
          })
        }
      }
      else {
        skippedFiles.push(filePath)
        if (progress) {
          progress({
            event: ProgressEvent.FileSkipped,
            updatedFiles: [],
            skippedFiles: [filePath],
            newVersion,
            oldVersion,
          })
        }
      }
    }

    // Execute custom commands before git operations
    if (execute) {
      const commands = Array.isArray(execute) ? execute : [execute]
      for (const command of commands) {
        console.log(colors.blue(`Executing: ${command}`))
        executeCommand(command)
        if (progress) {
          progress({
            event: ProgressEvent.Execute,
            script: command,
            updatedFiles,
            skippedFiles,
            newVersion,
            oldVersion,
          })
        }
      }
    }

    // Install dependencies if requested
    if (install) {
      console.log(colors.blue('Installing dependencies...'))
      try {
        executeCommand('npm install')
        if (progress) {
          progress({
            event: ProgressEvent.NpmScript,
            script: 'install',
            updatedFiles,
            skippedFiles,
            newVersion,
            oldVersion,
          })
        }
      }
      catch (error) {
        console.warn(colors.yellow(`Warning: Failed to install dependencies: ${error}`))
      }
    }

    // Git operations
    if (commit && updatedFiles.length > 0) {
      // Stage updated files
      const gitAddArgs = ['add', ...updatedFiles]
      executeCommand(`git ${gitAddArgs.join(' ')}`)

      // Create commit
      const commitMessage = typeof commit === 'string' ? commit : `chore: bump version to ${newVersion}`
      createGitCommit(commitMessage, sign, noVerify)

      if (progress) {
        progress({
          event: ProgressEvent.GitCommit,
          updatedFiles,
          skippedFiles,
          newVersion,
          oldVersion,
        })
      }
    }

    if (tag) {
      const tagName = typeof tag === 'string' ? tag : `v${newVersion}`
      createGitTag(tagName, sign)

      if (progress) {
        progress({
          event: ProgressEvent.GitTag,
          updatedFiles,
          skippedFiles,
          newVersion,
          oldVersion,
        })
      }
    }

    if (push) {
      pushToRemote(!!tag)

      if (progress) {
        progress({
          event: ProgressEvent.GitPush,
          updatedFiles,
          skippedFiles,
          newVersion,
          oldVersion,
        })
      }
    }

    console.log(colors.green(`\n${symbols.success} Successfully bumped version to ${newVersion}`))

    if (updatedFiles.length > 0) {
      console.log(colors.green(`${symbols.success} Updated ${updatedFiles.length} file(s)`))
    }

    if (skippedFiles.length > 0) {
      console.log(colors.yellow(`${symbols.warning} Skipped ${skippedFiles.length} file(s) that didn't need updates`))
    }
  }
  catch (error) {
    console.error(colors.red(`${symbols.error} ${error}`))
    throw error
  }
}

/**
 * Prompt user for version selection
 */
async function promptForVersion(currentVersion: string, preid?: string): Promise<string> {
  const { prompt } = await import('./utils')

  console.log(colors.blue(`Current version: ${colors.bold(currentVersion)}\n`))

  const releaseTypes = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']
  const suggestions: Array<{ type: string, version: string }> = []

  releaseTypes.forEach((type) => {
    try {
      const newVersion = incrementVersion(currentVersion, type as any, preid)
      suggestions.push({ type, version: newVersion })
    }
    catch {
      // Skip invalid combinations
    }
  })

  console.log(colors.blue('Select version increment:'))
  suggestions.forEach((suggestion, index) => {
    console.log(colors.gray(`  ${index + 1}. ${suggestion.type}: ${colors.bold(suggestion.version)}`))
  })
  console.log(colors.gray(`  ${suggestions.length + 1}. custom: enter custom version`))
  console.log()

  const answer = await prompt('Your choice (number or custom version):')

  const choice = Number.parseInt(answer, 10)
  if (choice >= 1 && choice <= suggestions.length) {
    return suggestions[choice - 1].version
  }
  else if (choice === suggestions.length + 1) {
    const customVersion = await prompt('Enter custom version:')
    return customVersion.trim()
  }
  else {
    // Try to parse as custom version
    return answer.trim()
  }
}
