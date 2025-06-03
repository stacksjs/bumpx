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

    // Validate release parameter early
    if (!release) {
      throw new Error('Release type or version must be specified')
    }

    // Update files
    const updatedFiles: string[] = []
    const skippedFiles: string[] = []
    const versionsProcessed = new Set<string>()
    const errors: string[] = []

    // Variables for tracking versions (needed for git operations and progress)
    let lastNewVersion: string | undefined
    let lastOldVersion: string | undefined

    // If currentVersion is specified, use single-version mode
    if (currentVersion) {
      // Validate current version
      if (!currentVersion) {
        throw new Error('Could not determine current version')
      }

      // Determine new version
      let newVersion: string
      if (release === 'prompt') {
        newVersion = await promptForVersion(currentVersion, preid)
      }
      else {
        try {
          newVersion = incrementVersion(currentVersion, release, preid)
        }
        catch {
          throw new Error(`Invalid release type or version: ${release}`)
        }
      }

      if (!newVersion) {
        throw new Error('Could not determine new version')
      }

      console.log(colors.blue(`\nBumping version from ${colors.bold(currentVersion)} to ${colors.bold(newVersion)}\n`))

      // Track versions for git operations
      lastNewVersion = newVersion
      lastOldVersion = currentVersion

      for (const filePath of filesToUpdate) {
        try {
          const fileInfo = updateVersionInFile(filePath, currentVersion, newVersion)

          if (fileInfo.updated) {
            updatedFiles.push(filePath)
            if (progress) {
              progress({
                event: ProgressEvent.FileUpdated,
                updatedFiles: [filePath],
                skippedFiles: [],
                newVersion,
                oldVersion: currentVersion,
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
                oldVersion: currentVersion,
              })
            }
          }
        }
        catch (error) {
          errors.push(`Failed to process ${filePath}: ${error}`)
          skippedFiles.push(filePath)
        }
      }
    }
    else {
      // Multi-version mode: bump each file from its own current version
      console.log(colors.blue('\nBumping versions independently for each file:\n'))

      for (const filePath of filesToUpdate) {
        try {
          // Get current version from this specific file
          let fileCurrentVersion: string | undefined
          if (filePath.endsWith('.json')) {
            // Try to read as JSON file (package.json or similar)
            try {
              const packageJson = readPackageJson(filePath)
              fileCurrentVersion = packageJson.version
              if (!fileCurrentVersion) {
                throw new Error('Could not determine current version')
              }
            }
            catch (error) {
              throw new Error(`Failed to read version from ${filePath}: ${error}`)
            }
          }
          else {
            // For non-JSON files, try to extract version from content
            const fs = await import('node:fs')
            const content = fs.readFileSync(filePath, 'utf-8')

            // Try multiple patterns to extract version
            const patterns = [
              // version: 1.2.3 (with optional quotes)
              /version\s*:\s*['"]?(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?)['"]?/i,
              // VERSION = '1.2.3' (with optional quotes)
              /version\s*=\s*['"]?(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?)['"]?/i,
              // Just a version number on its own line (for VERSION.txt files)
              /^(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?)$/m,
            ]

            for (const pattern of patterns) {
              const match = content.match(pattern)
              if (match) {
                fileCurrentVersion = match[1]
                break
              }
            }
          }

          if (!fileCurrentVersion) {
            console.log(colors.yellow(`Warning: Could not determine version for ${filePath}, skipping`))
            skippedFiles.push(filePath)
            continue
          }

          // Skip if we've already processed this version (avoid duplicate console output)
          if (!versionsProcessed.has(fileCurrentVersion)) {
            versionsProcessed.add(fileCurrentVersion)
          }

          // Determine new version for this file
          let fileNewVersion: string
          if (release === 'prompt') {
            fileNewVersion = await promptForVersion(fileCurrentVersion, preid)
          }
          else {
            try {
              fileNewVersion = incrementVersion(fileCurrentVersion, release, preid)
            }
            catch {
              throw new Error(`Invalid release type or version: ${release}`)
            }
          }

          if (!fileNewVersion) {
            throw new Error(`Could not determine new version for ${filePath}`)
          }

          console.log(colors.gray(`  ${filePath}: ${fileCurrentVersion} → ${fileNewVersion}`))

          const fileInfo = updateVersionInFile(filePath, fileCurrentVersion, fileNewVersion)

          if (fileInfo.updated) {
            updatedFiles.push(filePath)
            // Track the last processed version for git operations
            lastNewVersion = fileNewVersion
            lastOldVersion = fileCurrentVersion
            if (progress) {
              progress({
                event: ProgressEvent.FileUpdated,
                updatedFiles: [filePath],
                skippedFiles: [],
                newVersion: fileNewVersion,
                oldVersion: fileCurrentVersion,
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
                newVersion: fileNewVersion,
                oldVersion: fileCurrentVersion,
              })
            }
          }
        }
        catch (error) {
          console.log(colors.yellow(`Warning: Failed to process ${filePath}: ${error}`))
          errors.push(`Failed to process ${filePath}: ${error}`)
          skippedFiles.push(filePath)
        }
      }
    }

    // If there were critical errors and no files were updated, throw an error
    if (errors.length > 0 && updatedFiles.length === 0) {
      throw new Error(errors.length > 0 ? errors.join('; ') : 'Failed to update any files')
    }

    // Execute custom commands before git operations
    if (execute) {
      const commands = Array.isArray(execute) ? execute : [execute]
      for (const command of commands) {
        console.log(colors.blue(`Executing: ${command}`))
        executeCommand(command)
        if (progress && lastNewVersion && lastOldVersion) {
          progress({
            event: ProgressEvent.Execute,
            script: command,
            updatedFiles,
            skippedFiles,
            newVersion: lastNewVersion,
            oldVersion: lastOldVersion,
          })
        }
      }
    }

    // Install dependencies if requested
    if (install) {
      console.log(colors.blue('Installing dependencies...'))
      try {
        executeCommand('npm install')
        if (progress && lastNewVersion && lastOldVersion) {
          progress({
            event: ProgressEvent.NpmScript,
            script: 'install',
            updatedFiles,
            skippedFiles,
            newVersion: lastNewVersion,
            oldVersion: lastOldVersion,
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
      const commitMessage = typeof commit === 'string' ? commit : `chore: bump version to ${lastNewVersion || 'unknown'}`
      createGitCommit(commitMessage, sign, noVerify)

      if (progress && lastNewVersion && lastOldVersion) {
        progress({
          event: ProgressEvent.GitCommit,
          updatedFiles,
          skippedFiles,
          newVersion: lastNewVersion,
          oldVersion: lastOldVersion,
        })
      }
    }

    if (tag) {
      const tagName = typeof tag === 'string' ? tag : `v${lastNewVersion || 'unknown'}`
      createGitTag(tagName, sign)

      if (progress && lastNewVersion && lastOldVersion) {
        progress({
          event: ProgressEvent.GitTag,
          updatedFiles,
          skippedFiles,
          newVersion: lastNewVersion,
          oldVersion: lastOldVersion,
        })
      }
    }

    if (push) {
      pushToRemote(!!tag)

      if (progress && lastNewVersion && lastOldVersion) {
        progress({
          event: ProgressEvent.GitPush,
          updatedFiles,
          skippedFiles,
          newVersion: lastNewVersion,
          oldVersion: lastOldVersion,
        })
      }
    }

    console.log(colors.green(`\n${symbols.success} Successfully bumped version${lastNewVersion ? ` to ${lastNewVersion}` : 's'}`))

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
