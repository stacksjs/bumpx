/* eslint-disable no-console */
import type { FileInfo, VersionBumpOptions } from './types'
import { dirname, join, resolve } from 'node:path'

import process from 'node:process'
import { ProgressEvent } from './types'
import {
  checkGitStatus,
  createGitCommit,
  createGitTag,
  executeCommand,
  findAllPackageFiles,
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
    noGitCheck,
    install,
    execute,
    recursive,
    printCommits,
    dryRun,
    progress,
    forceUpdate = true,
    tagMessage,
    cwd,
    changelog = true,
  } = options

  // Backup system for rollback on cancellation
  const fileBackups = new Map<string, { content: string, version: string }>()
  let hasStartedUpdates = false
  let hasStartedGitOperations = false

  // Determine a safe working directory for all git operations
  // Priority: explicit options.cwd -> directory of the first file -> process.cwd()
  const effectiveCwd = cwd || (files && files.length > 0 ? dirname(files[0]) : process.cwd())

  try {
    // Print recent commits if requested
    if (printCommits && !dryRun) {
      try {
        const recentCommits = getRecentCommits(5, effectiveCwd)
        if (recentCommits.length > 0) {
          console.log('Recent commits:')
          for (const commit of recentCommits) {
            console.log(`  ${commit}`)
          }
        }
      }
      catch {
        // Ignore failures when not in a git repository
      }
    }

    // Check git status only when needed
    if (!noGitCheck && (tag || push) && !commit) {
      await checkGitStatus(effectiveCwd)
    }

    // Determine files to update
    let filesToUpdate: string[] = []
    let rootPackagePath: string | undefined

    if (files && files.length > 0) {
      filesToUpdate = files.map(file => resolve(file))
    }
    else if (recursive) {
      // Use workspace-aware discovery
      filesToUpdate = await findAllPackageFiles(effectiveCwd, recursive)

      // Find the root package.json for recursive mode
      rootPackagePath = filesToUpdate.find(
        file =>
          file.endsWith('package.json')
          && (file === join(effectiveCwd, 'package.json')
            || file === resolve(effectiveCwd, 'package.json')),
      )
    }
    else {
      filesToUpdate = await findPackageJsonFiles(effectiveCwd, false)
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
    let _lastOldVersion: string | undefined

    // If currentVersion is specified, use single-version mode
    if (currentVersion !== undefined) {
      // Validate current version
      if (!currentVersion || !currentVersion.trim()) {
        throw new Error('Current version cannot be empty')
      }

      // Determine new version
      let newVersion: string
      if (release === 'prompt') {
        if (dryRun) {
          // In dry run mode, just simulate a patch increment to avoid interactive prompts
          newVersion = incrementVersion(currentVersion, 'patch', preid)
        }
        else {
          newVersion = await promptForVersion(currentVersion, preid)
        }
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
        console.log(`\n[DRY RUN] Would bump version from ${currentVersion} to ${newVersion}\n`)
      }
      else {
        console.log(`\nBumping version from ${currentVersion} to ${newVersion}\n`)
      }

      // Track versions for git operations
      lastNewVersion = newVersion
      _lastOldVersion = currentVersion

      // Create backups of all files before updating
      for (const filePath of filesToUpdate) {
        try {
          const fs = await import('node:fs')
          const content = fs.readFileSync(filePath, 'utf-8')
          const packageJson = JSON.parse(content)
          fileBackups.set(filePath, { content, version: packageJson.version })
        }
        catch (error) {
          console.warn(`Warning: Could not backup ${filePath}: ${error}`)
        }
      }
      hasStartedUpdates = true

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
    else if (recursive && rootPackagePath) {
      // Recursive mode: use root package version for all packages
      let rootCurrentVersion: string
      try {
        const rootPackage = readPackageJson(rootPackagePath)
        rootCurrentVersion = rootPackage.version
        if (!rootCurrentVersion) {
          throw new Error('Could not determine root package version')
        }
      }
      catch (error) {
        throw new Error(`Failed to read root package version: ${error}`)
      }

      // Determine new version for root package (only once)
      let newVersion: string
      if (release === 'prompt') {
        if (dryRun) {
          // In dry run mode, just simulate a patch increment to avoid interactive prompts
          newVersion = incrementVersion(rootCurrentVersion, 'patch', preid)
        }
        else {
          newVersion = await promptForVersion(rootCurrentVersion, preid)
        }
      }
      else {
        try {
          newVersion = incrementVersion(rootCurrentVersion, release, preid)
        }
        catch {
          throw new Error(`Invalid release type or version: ${release}`)
        }
      }

      if (!newVersion) {
        throw new Error('Could not determine new version')
      }

      if (dryRun) {
        console.log(`\n[DRY RUN] Would bump root version from ${rootCurrentVersion} to ${newVersion} and update all workspace packages\n`)
      }
      else {
        console.log(`\nBumping root version from ${rootCurrentVersion} to ${newVersion} and updating all workspace packages\n`)
      }

      // Track versions for git operations (use root version)
      lastNewVersion = newVersion
      _lastOldVersion = rootCurrentVersion

      // Create backups of all files before updating
      for (const filePath of filesToUpdate) {
        try {
          const fs = await import('node:fs')
          const content = fs.readFileSync(filePath, 'utf-8')
          const packageJson = JSON.parse(content)
          fileBackups.set(filePath, { content, version: packageJson.version })
        }
        catch (error) {
          console.warn(`Warning: Could not backup ${filePath}: ${error}`)
        }
      }
      hasStartedUpdates = true

      // Update all files with the same version
      for (const filePath of filesToUpdate) {
        try {
          let fileInfo: FileInfo
          if (dryRun) {
            // In dry run mode, simulate the update without actually writing
            fileInfo = {
              path: filePath,
              content: '',
              updated: true, // Assume it would be updated
              oldVersion: rootCurrentVersion,
              newVersion,
            }
          }
          else {
            // In recursive mode, update all files to the new version regardless of their current version
            fileInfo = updateVersionInFile(filePath, rootCurrentVersion, newVersion, forceUpdate)
          }

          if (fileInfo.updated) {
            updatedFiles.push(filePath)
            if (progress) {
              progress({
                event: ProgressEvent.FileUpdated,
                updatedFiles: [filePath],
                skippedFiles: [],
                newVersion,
                oldVersion: rootCurrentVersion,
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
                oldVersion: rootCurrentVersion,
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
        console.log(`\n[DRY RUN] Would bump versions independently for each file:\n`)
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
              /version\s*[:=]\s*['"]?(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?)['"]?/i,
              /VERSION\s*=\s*['"]?(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0.9\-]+)?)['"]?/i,
              // VERSION = '1.2.3' (with optional quotes)
              /^(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0.9\-]+)?)$/m,
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
            console.log(`Warning: Could not determine version for ${filePath}, skipping`)
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
            if (dryRun) {
              // In dry run mode, just simulate a patch increment to avoid interactive prompts
              fileNewVersion = incrementVersion(fileCurrentVersion, 'patch', preid)
            }
            else {
              fileNewVersion = await promptForVersion(fileCurrentVersion, preid)
            }
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

          console.log(`  ${filePath}: ${fileCurrentVersion} → ${fileNewVersion}`)

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
            _lastOldVersion = fileCurrentVersion
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
          console.log(`Warning: Failed to process ${filePath}: ${error}`)
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
      try {
        const commands = Array.isArray(execute) ? execute : [execute]
        for (const command of commands) {
          if (progress) {
            // Provide full payload to satisfy VersionBumpProgress typing
            progress({
              event: ProgressEvent.Execute,
              script: command,
              updatedFiles,
              skippedFiles,
              newVersion: lastNewVersion || '',
              oldVersion: _lastOldVersion,
            })
          }
          executeCommand(command, effectiveCwd)
        }
      }
      catch (error) {
        console.warn(`Warning: Command execution failed: ${error}`)
      }
    }
    else if (execute && dryRun) {
      const commands = Array.isArray(execute) ? execute : [execute]
      for (const command of commands) {
        console.log(`[DRY RUN] Would execute: ${command}`)
      }
    }

    // Install dependencies if requested
    if (install && !dryRun) {
      try {
        console.log('Installing dependencies...')
        if (progress) {
          progress({
            event: ProgressEvent.NpmScript,
            script: 'install',
            updatedFiles,
            skippedFiles,
            newVersion: lastNewVersion || '',
            oldVersion: _lastOldVersion,
          })
        }
        executeCommand('npm install', effectiveCwd)
      }
      catch (error) {
        console.warn(`Warning: Install failed: ${error}`)
      }
    }
    else if (install && dryRun) {
      console.log('[DRY RUN] Would install dependencies')
    }

    // Generate changelog BEFORE committing (if enabled)
    if (changelog && lastNewVersion && !dryRun) {
      try {
        // Generate changelog with specific version range
        const fromVersion = _lastOldVersion ? `v${_lastOldVersion}` : undefined
        const toVersion = `v${lastNewVersion}`

        await generateChangelog(effectiveCwd, fromVersion, toVersion)

        if (progress && _lastOldVersion) {
          progress({
            event: ProgressEvent.ChangelogGenerated,
            updatedFiles,
            skippedFiles,
            newVersion: lastNewVersion,
            oldVersion: _lastOldVersion,
          })
        }
      }
      catch (error) {
        console.warn('Warning: Failed to generate changelog:', error)
      }
    }
    else if (changelog && lastNewVersion && dryRun) {
      const fromVersion = _lastOldVersion ? `v${_lastOldVersion}` : undefined
      const toVersion = `v${lastNewVersion}`
      const versionRange = fromVersion ? `from ${fromVersion} to ${toVersion}` : `up to ${toVersion}`
      console.log(`[DRY RUN] Would generate changelog ${versionRange}`)
    }

    // Git operations
    if (commit && updatedFiles.length > 0 && !dryRun) {
      hasStartedGitOperations = true
      // Stage all changes (existing dirty files + version updates + changelog)
      try {
        const { executeGit } = await import('./utils')
        executeGit(['add', '-A'], effectiveCwd)
      }
      catch (error) {
        console.warn('Warning: Failed to stage changes:', error)
      }

      // Create commit
      let commitMessage = typeof commit === 'string' ? commit : `chore: release v${lastNewVersion || 'unknown'}`

      // Replace template variables in commit message
      if (typeof commit === 'string' && lastNewVersion) {
        commitMessage = commitMessage.replace(/\{version\}/g, lastNewVersion).replace(/%s/g, lastNewVersion)
      }

      createGitCommit(commitMessage, false, false, effectiveCwd)

      if (progress && lastNewVersion && _lastOldVersion) {
        progress({
          event: ProgressEvent.GitCommit,
          updatedFiles,
          skippedFiles,
          newVersion: lastNewVersion,
          oldVersion: _lastOldVersion,
        })
      }
    }
    else if (commit && updatedFiles.length > 0 && dryRun) {
      let commitMessage = typeof commit === 'string' ? commit : `chore: release v${lastNewVersion || 'unknown'}`
      if (typeof commit === 'string' && lastNewVersion) {
        commitMessage = commitMessage.replace(/\{version\}/g, lastNewVersion).replace(/%s/g, lastNewVersion)
      }
      console.log(`[DRY RUN] Would create git commit: "${commitMessage}"`)
    }

    // Create git tag if requested
    if (tag && updatedFiles.length > 0 && !dryRun && lastNewVersion) {
      const tagName = typeof tag === 'string'
        ? tag.replace('{version}', lastNewVersion).replace('%s', lastNewVersion)
        : `v${lastNewVersion}`
      const finalTagMessage = tagMessage
        ? tagMessage.replace('{version}', lastNewVersion).replace('%s', lastNewVersion)
        : `Release ${lastNewVersion}`
      createGitTag(tagName, false, finalTagMessage, effectiveCwd)

      if (progress && lastNewVersion && _lastOldVersion) {
        progress({
          event: ProgressEvent.GitTag,
          updatedFiles,
          skippedFiles,
          newVersion: lastNewVersion,
          oldVersion: _lastOldVersion,
        })
      }
    }
    else if (tag && dryRun && lastNewVersion) {
      const tagName = typeof tag === 'string'
        ? tag.replace('{version}', lastNewVersion).replace('%s', lastNewVersion)
        : `v${lastNewVersion}`
      const finalTagMessage = tagMessage
        ? tagMessage.replace('{version}', lastNewVersion).replace('%s', lastNewVersion)
        : `Release ${lastNewVersion}`
      console.log(`[DRY RUN] Would create git tag: "${tagName}" with message: "${finalTagMessage}"`)
    }

    // Handle changelog generation for cases where commit is disabled
    // This allows users to generate changelog without committing
    if (changelog && !commit && lastNewVersion && !dryRun) {
      try {
        // Generate changelog with specific version range
        const fromVersion = _lastOldVersion ? `v${_lastOldVersion}` : undefined
        const toVersion = `v${lastNewVersion}`

        await generateChangelog(effectiveCwd, fromVersion, toVersion)

        if (progress && _lastOldVersion) {
          progress({
            event: ProgressEvent.ChangelogGenerated,
            updatedFiles,
            skippedFiles,
            newVersion: lastNewVersion,
            oldVersion: _lastOldVersion,
          })
        }
      }
      catch (error) {
        console.warn('Warning: Failed to generate changelog:', error)
      }
    }

    if (push && !dryRun) {
      pushToRemote(!!tag, effectiveCwd)

      if (progress && lastNewVersion && _lastOldVersion) {
        progress({
          event: ProgressEvent.GitPush,
          updatedFiles,
          skippedFiles,
          newVersion: lastNewVersion,
          oldVersion: _lastOldVersion,
        })
      }
    }
    else if (push && dryRun) {
      console.log(`[DRY RUN] Would pull latest changes from remote`)
      console.log(`[DRY RUN] Would push to remote${tag ? ' (including tags)' : ''}`)
    }

    // Helper function for proper pluralization
    const pluralize = (count: number, singular: string, plural: string = `${singular}s`) =>
      count === 1 ? `${count} ${singular}` : `${count} ${plural}`

    if (dryRun) {
      console.log(`\n${symbols.success} [DRY RUN] Would bump version${lastNewVersion ? ` to ${lastNewVersion}` : 's'}`)
      if (updatedFiles.length > 0) {
        console.log(`${symbols.success} Would update ${pluralize(updatedFiles.length, 'file')}`)
      }
    }
    else {
      console.log(`\n${symbols.success} Successfully bumped version${lastNewVersion ? ` to ${lastNewVersion}` : 's'}`)
      if (updatedFiles.length > 0) {
        console.log(`${symbols.success} Updated ${pluralize(updatedFiles.length, 'file')}`)
      }
    }

    if (skippedFiles.length > 0) {
      console.log(`${symbols.warning} Skipped ${pluralize(skippedFiles.length, 'file')} that didn't need updates`)
    }
  }
  catch (error) {
    // If we've started updates and this is a cancellation, rollback changes
    if (hasStartedUpdates && error instanceof Error && error.message === 'Version bump cancelled by user') {
      console.log('\nRolling back changes due to cancellation...')
      await rollbackChanges(fileBackups, hasStartedGitOperations)
      console.log('Rollback completed. No changes were made.')
      throw error
    }

    // For other errors, attempt rollback if we've made changes
    if (hasStartedUpdates && fileBackups.size > 0) {
      console.log('\nRolling back changes due to error...')
      await rollbackChanges(fileBackups, hasStartedGitOperations)
      console.log('Rollback completed due to error.')
    }

    console.error(`${symbols.error} ${error}`)
    throw error
  }
}

/**
 * Generate changelog using @stacksjs/logsmith
 */
async function generateChangelog(cwd: string, fromVersion?: string, toVersion?: string): Promise<void> {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { executeGit } = await import('./utils')

  const changelogPath = path.join(cwd, 'CHANGELOG.md')
  let existingContent = ''

  // Read existing changelog content if it exists
  if (fs.existsSync(changelogPath)) {
    try {
      existingContent = fs.readFileSync(changelogPath, 'utf-8')
      // Ensure there's a proper separator if content exists
      if (existingContent.trim() && !existingContent.endsWith('\n\n')) {
        existingContent += '\n\n'
      }
    }
    catch (error) {
      console.warn('Warning: Could not read existing CHANGELOG.md:', error)
    }
  }

  // Check if the desired tag exists, otherwise use HEAD
  let actualToVersion = toVersion
  if (toVersion && toVersion !== 'HEAD') {
    try {
      // Check if the tag exists
      await executeGit(['rev-parse', '--verify', toVersion], cwd)
      // Tag exists, use it
    }
    catch {
      // Tag doesn't exist, use HEAD instead
      console.warn(`Warning: Tag ${toVersion} doesn't exist yet, using HEAD for changelog generation`)
      actualToVersion = 'HEAD'
    }
  }

  try {
    // Dynamic import to avoid top-level import issues
    const logsmithModule: any = await import('@stacksjs/logsmith')
    const generateChangelogFn = logsmithModule.generateChangelog || logsmithModule.default?.generateChangelog

    if (!generateChangelogFn) {
      throw new Error('Unable to import generateChangelog from @stacksjs/logsmith')
    }

    // Generate changelog with logsmith
    const options: any = {
      output: 'CHANGELOG.md',
      cwd,
    }

    // Add version range if specified
    if (fromVersion) {
      options.from = fromVersion
    }
    if (actualToVersion) {
      options.to = actualToVersion
    }

    await generateChangelogFn(options)

    // Read the newly generated content
    let newContent = ''
    if (fs.existsSync(changelogPath)) {
      newContent = fs.readFileSync(changelogPath, 'utf-8')
    }

    // If we have existing content, prepend it to the new content
    if (existingContent.trim()) {
      // Check if the new content already contains some of the existing content
      // to avoid duplication
      if (!newContent.includes(existingContent.trim())) {
        newContent = existingContent + newContent
      }
    }

    // Write the combined content back to the file
    fs.writeFileSync(changelogPath, newContent, 'utf-8')
  }
  catch (error: any) {
    // If logsmith is not available or fails, try using the CLI command as fallback
    try {
      const { executeCommand } = await import('./utils')
      let command = 'bunx logsmith --output CHANGELOG.md'

      // Add version range parameters to CLI command
      if (fromVersion) {
        command += ` --from ${fromVersion}`
      }
      if (actualToVersion) {
        command += ` --to ${actualToVersion}`
      }

      executeCommand(command, cwd)

      // Read the newly generated content
      let newContent = ''
      if (fs.existsSync(changelogPath)) {
        newContent = fs.readFileSync(changelogPath, 'utf-8')
      }

      // If we have existing content, prepend it to the new content
      if (existingContent.trim()) {
        // Check if the new content already contains some of the existing content
        // to avoid duplication
        if (!newContent.includes(existingContent.trim())) {
          newContent = existingContent + newContent
        }
      }

      // Write the combined content back to the file
      fs.writeFileSync(changelogPath, newContent, 'utf-8')
    }
    catch (fallbackError) {
      throw new Error(`Changelog generation failed: ${error.message}. Fallback also failed: ${fallbackError}`)
    }
  }
}

/**
 * Rollback file changes to their original state and unstage Git changes
 */
async function rollbackChanges(fileBackups: Map<string, { content: string, version: string }>, hasStartedGitOperations: boolean = false): Promise<void> {
  // First, unstage any staged changes if Git operations were started
  if (hasStartedGitOperations) {
    try {
      const { executeGit } = await import('./utils')
      executeGit(['reset', 'HEAD'], process.cwd())
      console.log('Unstaged all Git changes')
    }
    catch (unstageError) {
      console.warn(`Warning: Failed to unstage Git changes: ${unstageError}`)
    }
  }

  // Then restore file contents to their original state
  for (const [filePath, backup] of fileBackups) {
    try {
      const fs = await import('node:fs')
      fs.writeFileSync(filePath, backup.content, 'utf-8')
    }
    catch (rollbackError) {
      console.warn(`Warning: Failed to rollback ${filePath}: ${rollbackError}`)
    }
  }
}

/**
 * Prompt user for version selection
 */
async function promptForVersion(currentVersion: string, preid?: string): Promise<string> {
  // Prevent prompting during tests to avoid hanging
  if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test' || process.argv.includes('test')) {
    // In test mode, just return a simulated patch increment
    return incrementVersion(currentVersion, 'patch', preid)
  }

  try {
    // Dynamic import to avoid top-level import issues
    const clappModule: any = await import('@stacksjs/clapp')
    const select = clappModule.select || clappModule.default?.select || clappModule.CLI?.select
    const text = clappModule.text || clappModule.default?.text || clappModule.CLI?.text

    if (!select || !text) {
      throw new Error('Unable to import interactive prompt functions from @stacksjs/clapp')
    }

    console.log(`Current version: ${currentVersion}\n`)

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
      label: `${suggestion.type} ${suggestion.version}`,
    }))
    suggestionsOptions.push({
      value: 'custom',
      label: 'custom ...',
    })

    try {
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
    catch (promptError: any) {
      // Check if this is a cancellation/interruption
      if (promptError.message?.includes('cancelled')
        || promptError.message?.includes('interrupted')
        || promptError.message?.includes('SIGINT')
        || promptError.message?.includes('SIGTERM')) {
        throw new Error('Version bump cancelled by user')
      }
      throw promptError
    }
  }
  catch (error: any) {
    // Don't fallback to patch increment on cancellation - let the error propagate
    if (error.message === 'Version bump cancelled by user') {
      throw error
    }

    // For other errors, provide a helpful message
    console.warn('Warning: Interactive prompt failed')
    throw new Error(`Failed to get version selection: ${error.message}`)
  }
}
