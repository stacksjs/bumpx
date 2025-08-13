/* eslint-disable no-console */
import type { FileInfo, VersionBumpOptions } from './types'
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
    tagMessage,
    push,
    sign,
    noGitCheck,
    noVerify,
    install,
    ignoreScripts: _ignoreScripts,
    execute,
    progress,
    recursive,
    printCommits,
    dryRun,
  } = options

  try {
    // Print recent commits if requested
    if (printCommits) {
      console.log(colors.blue('\nRecent commits:'))
      const commits = getRecentCommits(10, process.cwd())
      commits.forEach(commit => console.log(colors.gray(`  ${commit}`)))
      console.log()
    }

    // Check git status unless disabled
    if (!noGitCheck) {
      checkGitStatus(process.cwd())
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
    if (currentVersion !== undefined) {
    // Validate current version
      if (!currentVersion || !currentVersion.trim()) {
        throw new Error('Current version cannot be empty')
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

      if (dryRun) {
        console.log(colors.blue(`\n[DRY RUN] Would bump version from ${colors.bold(currentVersion)} to ${colors.bold(newVersion)}\n`))
      }
      else {
        console.log(colors.blue(`\nBumping version from ${colors.bold(currentVersion)} to ${colors.bold(newVersion)}\n`))
      }

      // Track versions for git operations
      lastNewVersion = newVersion
      lastOldVersion = currentVersion

      for (const filePath of filesToUpdate) {
        try {
          let fileInfo: FileInfo
          if (dryRun) {
            // In dry run mode, simulate the update without actually writing
            fileInfo = {
              path: filePath,
              content: '',
              updated: true, // Assume it would be updated
              oldVersion: currentVersion,
              newVersion,
            }
          }
          else {
            fileInfo = updateVersionInFile(filePath, currentVersion, newVersion)
          }

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
      if (dryRun) {
        console.log(colors.blue('\n[DRY RUN] Would bump versions independently for each file:\n'))
      }

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

          let fileInfo: FileInfo
          if (dryRun) {
            // In dry run mode, simulate the update without actually writing
            fileInfo = {
              path: filePath,
              content: '',
              updated: true, // Assume it would be updated
              oldVersion: fileCurrentVersion,
              newVersion: fileNewVersion,
            }
          }
          else {
            fileInfo = updateVersionInFile(filePath, fileCurrentVersion, fileNewVersion)
          }

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
    if (execute && !dryRun) {
      const commands = Array.isArray(execute) ? execute : [execute]
      for (const command of commands) {
        console.log(colors.blue(`Executing: ${command}`))
        try {
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
        catch (error) {
          console.warn(colors.yellow(`Warning: Failed to execute command: ${error}`))
        }
      }
    }
    else if (execute && dryRun) {
      const commands = Array.isArray(execute) ? execute : [execute]
      for (const command of commands) {
        console.log(colors.blue(`[DRY RUN] Would execute: ${command}`))
      }
    }

    // Install dependencies if requested
    if (install && !dryRun) {
      console.log(colors.blue('Installing dependencies...'))
      try {
        // Prefer running install in the directory of the first updated file
        const installCwd = updatedFiles.length > 0 ? resolve(updatedFiles[0], '..') : process.cwd()
        executeCommand('npm install', installCwd)
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
    else if (install && dryRun) {
      console.log(colors.blue('[DRY RUN] Would install dependencies'))
    }

    // Git operations
    if (commit && updatedFiles.length > 0 && !dryRun) {
      // Stage updated files
      const gitAddArgs = ['add', ...updatedFiles]
      executeCommand(`git ${gitAddArgs.join(' ')}`)

      // Create commit
      let commitMessage = typeof commit === 'string' ? commit : `chore: release ${lastNewVersion || 'unknown'}`

      // Replace template variables in commit message
      if (typeof commit === 'string' && lastNewVersion) {
        commitMessage = commitMessage.replace(/\{version\}/g, lastNewVersion).replace(/%s/g, lastNewVersion)
      }

      createGitCommit(commitMessage, sign, noVerify, process.cwd())

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
    else if (commit && updatedFiles.length > 0 && dryRun) {
      let commitMessage = typeof commit === 'string' ? commit : `chore: release ${lastNewVersion || 'unknown'}`
      if (typeof commit === 'string' && lastNewVersion) {
        commitMessage = commitMessage.replace(/\{version\}/g, lastNewVersion).replace(/%s/g, lastNewVersion)
      }
      console.log(colors.blue(`[DRY RUN] Would create git commit: "${commitMessage}"`))
    }

    if (tag && !dryRun) {
      let tagName = typeof tag === 'string' ? tag : `v${lastNewVersion || 'unknown'}`

      // Replace template variables in tag name
      if (typeof tag === 'string' && lastNewVersion) {
        tagName = tagName.replace(/\{version\}/g, lastNewVersion)
      }

      // Replace template variables in tag message
      let finalTagMessage = tagMessage
      if (tagMessage && lastNewVersion) {
        finalTagMessage = tagMessage.replace(/\{version\}/g, lastNewVersion).replace(/%s/g, lastNewVersion)
      }

      createGitTag(tagName, sign, finalTagMessage, process.cwd())

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
    else if (tag && dryRun) {
      let tagName = typeof tag === 'string' ? tag : `v${lastNewVersion || 'unknown'}`
      if (typeof tag === 'string' && lastNewVersion) {
        tagName = tagName.replace(/\{version\}/g, lastNewVersion)
      }
      let finalTagMessage = tagMessage
      if (tagMessage && lastNewVersion) {
        finalTagMessage = tagMessage.replace(/\{version\}/g, lastNewVersion).replace(/%s/g, lastNewVersion)
      }
      console.log(colors.blue(`[DRY RUN] Would create git tag: "${tagName}"${finalTagMessage ? ` with message: "${finalTagMessage}"` : ''}`))
    }

    if (push && !dryRun) {
      pushToRemote(!!tag, process.cwd())

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
    else if (push && dryRun) {
      console.log(colors.blue(`[DRY RUN] Would push to remote${tag ? ' (including tags)' : ''}`))
    }

    // Helper function for proper pluralization
    const pluralize = (count: number, singular: string, plural: string = `${singular}s`) =>
      count === 1 ? `${count} ${singular}` : `${count} ${plural}`

    if (dryRun) {
      console.log(colors.gray(`\n${symbols.success} [DRY RUN] Would bump version${lastNewVersion ? ` to ${lastNewVersion}` : 's'}`))
      if (updatedFiles.length > 0) {
        console.log(colors.gray(`${symbols.success} Would update ${pluralize(updatedFiles.length, 'file')}`))
      }
    }
    else {
      console.log(colors.gray(`\n${symbols.success} Successfully bumped version${lastNewVersion ? ` to ${lastNewVersion}` : 's'}`))
      if (updatedFiles.length > 0) {
        console.log(colors.gray(`${symbols.success} Updated ${pluralize(updatedFiles.length, 'file')}`))
      }
    }

    if (skippedFiles.length > 0) {
      console.log(colors.yellow(`${symbols.warning} Skipped ${pluralize(skippedFiles.length, 'file')} that didn't need updates`))
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
  // Dynamic import to avoid top-level import issues
  const clappModule: any = await import('@stacksjs/clapp')
  const select = clappModule.select || clappModule.default?.select || clappModule.CLI?.select
  const text = clappModule.text || clappModule.default?.text || clappModule.CLI?.text

  if (!select || !text) {
    throw new Error('Unable to import interactive prompt functions from @stacksjs/clapp')
  }

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

  const suggestionsOptions = suggestions.map(suggestion => ({
    value: suggestion.version,
    label: `${suggestion.type} ${colors.bold(suggestion.version)}`,
  }))
  suggestionsOptions.push({
    value: 'custom',
    label: 'custom ...',
  })
  const selectedOption = await select({
    message: 'Choose an option:',
    options: suggestionsOptions,
  })

  if (selectedOption === 'custom') {
    const customV = await text({
      message: 'Enter the new version number:',
      placeholder: `${currentVersion}`,
    })
    return customV.trim()
  }

  return selectedOption.trim()
}
