/* eslint-disable no-console */
import type { FileInfo, VersionBumpOptions } from './types'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { userInterrupted } from './interrupt'
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
  isGitRepository,
  isValidVersion,
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
    forceUpdate,
    tagMessage,
    cwd,
    changelog = true,
    respectGitignore = true,
  } = options

  // Backup system for rollback on cancellation
  const fileBackups = new Map<string, { content: string, version: string }>()
  let hasStartedUpdates = false
  let hasStartedGitOperations = false

  // Determine a safe working directory for all git operations
  // Priority: explicit options.cwd -> directory of the first file -> process.cwd()
  const effectiveCwd = cwd || (files && files.length > 0 ? dirname(files[0]) : process.cwd())
  // Determine if we're inside a Git repository once and reuse
  const inGitRepo = isGitRepository(effectiveCwd)

  try {
    // Print recent commits if requested
    if (printCommits && inGitRepo) {
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
      filesToUpdate = files.map(file => resolve(effectiveCwd, file))
    }
    else if (recursive) {
      // Use workspace-aware discovery
      filesToUpdate = await findAllPackageFiles(effectiveCwd, recursive, respectGitignore)

      // Find the root package.json for recursive mode
      rootPackagePath = filesToUpdate.find(
        file =>
          file.endsWith('package.json')
          && (file === join(effectiveCwd, 'package.json')
            || file === resolve(effectiveCwd, 'package.json')),
      )
    }
    else {
      filesToUpdate = await findPackageJsonFiles(effectiveCwd, false, respectGitignore)
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
        newVersion = await promptForVersion(currentVersion, preid, effectiveCwd, dryRun)
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
          // First, check if the file actually contains the expected current version
          const originalContent = readFileSync(filePath, 'utf-8')
          let shouldUpdate = false

          if (filePath.endsWith('.json')) {
            try {
              const packageJson = JSON.parse(originalContent)
              shouldUpdate = packageJson.version === currentVersion || (forceUpdate === true)
            }
            catch {
              // If JSON parsing fails, skip this file
              shouldUpdate = false
            }
          }
          else {
            // For non-JSON files, check if the current version exists in the content
            shouldUpdate = originalContent.includes(currentVersion) || (forceUpdate === true)
          }

          let fileInfo: FileInfo
          if (shouldUpdate) {
            // Always call updateVersionInFile to ensure mocks are triggered in tests
            fileInfo = updateVersionInFile(filePath, currentVersion, newVersion, forceUpdate || false)
            // If in dry run mode, restore the original content after the operation
            if (dryRun) {
              writeFileSync(filePath, originalContent, 'utf-8')
            }
          }
          else {
            // File doesn't contain the expected version, mark as not updated
            fileInfo = {
              path: filePath,
              content: originalContent,
              updated: false,
              oldVersion: undefined,
              newVersion: undefined,
            }
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
          // For permission errors and other critical file system errors, throw immediately
          if (error instanceof Error && (
            error.message.includes('EACCES')
            || error.message.includes('permission denied')
            || error.message.includes('EPERM')
            || (error as any).code === 'EACCES'
            || (error as any).code === 'EPERM'
          )) {
            throw error
          }
          errors.push(`Failed to process ${filePath}: ${error}`)
          skippedFiles.push(filePath)
        }
      }
    }
    else if (recursive && rootPackagePath) {
      // Recursive mode: use root package version for all packages
      const rootPackage = readPackageJson(rootPackagePath)
      const rootCurrentVersion = rootPackage.version
      if (!rootCurrentVersion) {
        throw new Error('Could not determine root package version')
      }

      // Check if user has interrupted before determining version
      if (userInterrupted.value) {
        // Exit immediately on interruption - no need for more messages
        process.exit(0)
      }

      // Set up a SIGINT handler at the process level
      // This is a backup handler if other handlers fail
      const sigintListener = () => {
        userInterrupted.value = true
        // Let the global handler in cli.ts handle the message
        process.exit(0) // Exit immediately
      }

      // Add the handler temporarily
      process.on('SIGINT', sigintListener)

      // Remember to clean up the handler later
      const cleanupSigintListener = () => {
        process.removeListener('SIGINT', sigintListener)
      }

      // Determine new version for root package (only once)
      let newVersion: string
      if (release === 'prompt') {
        // Check for early interruption
        if (userInterrupted.value) {
          process.exit(0)
        }

        // In test environments, avoid setInterval to prevent hanging
        if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test' || process.argv.some(arg => arg.includes('test'))) {
          newVersion = incrementVersion(rootCurrentVersion, 'patch', preid)
          cleanupSigintListener()
        }
        else {
          // Use a timeout to ensure the process exits if promptForVersion gets stuck
          const promptTimeout = setInterval(() => {
            if (userInterrupted.value) {
              clearInterval(promptTimeout)
              console.log('\nPrompt timeout - cancelling operation')
              process.exit(0)
            }
          }, 50) // Check very frequently

          try {
            newVersion = await promptForVersion(rootCurrentVersion, preid, effectiveCwd, dryRun)
            clearInterval(promptTimeout)
            cleanupSigintListener()
          }
          catch (error) {
            clearInterval(promptTimeout)
            cleanupSigintListener()
            // If this was a user interruption, exit gracefully
            if (userInterrupted.value || (error instanceof Error
              && (error.message.includes('cancelled') || error.message.includes('interrupted')))) {
                // Let the global handler show message
                process.exit(0)
              }
            throw error
          }
        }

        // Check again after prompt in case user interrupted during version selection
        if (userInterrupted.value) {
          // Let global handler show message
          process.exit(0) // Exit immediately on interruption
        }
      }
      else {
        // Clean up in non-prompt case too
        cleanupSigintListener()
        try {
          // For non-prompt releases, calculate the new version directly
          // Check if the release is a valid semver version
          if (isValidVersion(release)) {
            // If the release is a valid semver version, use it directly
            newVersion = release
          }
          else {
            // Increment version based on the release type
            newVersion = incrementVersion(rootCurrentVersion, release, preid)
          }
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

      // Check for interruption again before tag check
      if (userInterrupted.value) {
        // Let the global handler show message
        process.exit(0)
      }

      // Check if tag already exists after version selection but before file changes
      if (tag && !dryRun && inGitRepo) {
        const { gitTagExists } = await import('./utils')
        // Format the tag name - either use the provided format or default to vX.Y.Z
        const tagName = typeof tag === 'string'
          ? tag.replace('{version}', newVersion).replace('%s', newVersion)
          : `v${newVersion}`

        if (gitTagExists(tagName, effectiveCwd)) {
          // Create error with proper handling flag to prevent duplicate messages
          const handledError = new Error(`Git tag '${tagName}' already exists. Use a different version.`)
          // Mark as handled to prevent duplicate error messages
          const handledSymbol = Symbol.for('bumpx.errorHandled')
          ;(handledError as any)[handledSymbol] = true
          throw handledError
        }
      }

      // Create backups of all files before updating
      for (const filePath of filesToUpdate) {
        try {
          const originalContent = readFileSync(filePath, 'utf-8')
          fileBackups.set(filePath, { content: originalContent, version: rootCurrentVersion })
        }
        catch (error) {
          console.warn(`Warning: Could not backup ${filePath}: ${error}`)
        }
      }
      hasStartedUpdates = true

      // Check for interrupt before updating files
      if (userInterrupted.value) {
        // Let the global handler show message
        process.exit(0)
      }

      // Update all files with the same version
      for (const filePath of filesToUpdate) {
        try {
          // Create a backup of the file content before modification
          const originalContent = readFileSync(filePath, 'utf-8')

          // In recursive mode, we need to get each file's current version for proper tracking
          let fileCurrentVersion = rootCurrentVersion
          if (filePath.endsWith('.json')) {
            try {
              const packageJson = JSON.parse(originalContent)
              fileCurrentVersion = packageJson.version || rootCurrentVersion
            }
            catch {
              fileCurrentVersion = rootCurrentVersion
            }
          }

          // Always call updateVersionInFile to ensure mocks are triggered in tests
          // In recursive mode, default to forcing updates unless explicitly set to false
          const shouldForceInRecursive = forceUpdate === undefined ? true : forceUpdate

          // When forceUpdate is false, only update files that match the root version
          const versionToMatch = shouldForceInRecursive ? fileCurrentVersion : rootCurrentVersion
          const fileInfo = updateVersionInFile(filePath, versionToMatch, newVersion, shouldForceInRecursive)
          // If in dry run mode, restore the original content after the operation
          if (dryRun) {
            writeFileSync(filePath, originalContent, 'utf-8')
          }

          if (fileInfo.updated) {
            updatedFiles.push(filePath)
            if (progress) {
              progress({
                event: ProgressEvent.FileUpdated,
                updatedFiles: [filePath],
                skippedFiles: [],
                newVersion,
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
                newVersion,
                oldVersion: fileCurrentVersion,
              })
            }
          }
        }
        catch (error) {
          // For permission errors and other critical file system errors, throw immediately
          if (error instanceof Error && (
            error.message.includes('EACCES')
            || error.message.includes('permission denied')
            || error.message.includes('EPERM')
            || (error as any).code === 'EACCES'
            || (error as any).code === 'EPERM'
          )) {
            throw error
          }
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
            const content = readFileSync(filePath, 'utf-8')

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
            fileNewVersion = await promptForVersion(fileCurrentVersion, preid, effectiveCwd, dryRun)
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

          // Create a backup of the file content before modification
          const originalContent = readFileSync(filePath, 'utf-8')
          // Always call updateVersionInFile to ensure mocks are triggered in tests
          const fileInfo = updateVersionInFile(filePath, fileCurrentVersion, fileNewVersion, forceUpdate)
          // If in dry run mode, restore the original content after the operation
          if (dryRun) {
            writeFileSync(filePath, originalContent, 'utf-8')
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
          // For permission errors and other critical file system errors, throw immediately
          if (error instanceof Error && (
            error.message.includes('EACCES')
            || error.message.includes('permission denied')
            || error.message.includes('EPERM')
            || (error as any).code === 'EACCES'
            || (error as any).code === 'EPERM'
          )) {
            throw error
          }
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

    // Check for interrupt before Git operations
    if (userInterrupted.value) {
      // Perform rollback but let global handler show main message
      await rollbackChanges(fileBackups, hasStartedGitOperations, effectiveCwd)
      console.log('Rollback completed due to user interruption.')
      process.exit(0)
    }

    // Git operations
    if (!dryRun && (commit || tag || push) && updatedFiles.length > 0) {
      hasStartedGitOperations = true
      // Stage all changes (existing dirty files + version updates)
      try {
        const { executeGit } = await import('./utils')
        executeGit(['add', '-A'], effectiveCwd)
      }
      catch (error) {
        console.warn('Warning: Failed to stage changes:', error)
      }

      // Check for interrupt before commit
      if (userInterrupted.value) {
        // Perform rollback but let global handler show main message
        await rollbackChanges(fileBackups, hasStartedGitOperations, effectiveCwd)
        console.log('Rollback completed due to user interruption.')
        process.exit(0)
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
    else if (commit && updatedFiles.length > 0 && !inGitRepo && !dryRun) {
      console.warn('Warning: Requested to create a git commit but current directory is not a Git repository. Skipping commit...')
    }
    else if (commit && updatedFiles.length > 0 && dryRun) {
      let commitMessage = typeof commit === 'string' ? commit : `chore: release v${lastNewVersion || 'unknown'}`
      if (typeof commit === 'string' && lastNewVersion) {
        commitMessage = commitMessage.replace(/\{version\}/g, lastNewVersion).replace(/%s/g, lastNewVersion)
      }
      console.log(`[DRY RUN] Would create git commit: "${commitMessage}"`)
    }

    // Generate changelog AFTER commit creation (if enabled)
    if (changelog && lastNewVersion && !dryRun && inGitRepo) {
      try {
        // Generate changelog with specific version range (using HEAD since tag doesn't exist yet)
        const fromVersion = _lastOldVersion ? `v${_lastOldVersion}` : undefined
        const toVersion = 'HEAD' // Use HEAD since tag doesn't exist yet

        await generateChangelog(effectiveCwd, fromVersion, toVersion)

        // Amend the changelog to the existing commit
        const { executeGit } = await import('./utils')
        executeGit(['add', 'CHANGELOG.md'], effectiveCwd)
        executeGit(['commit', '--amend', '--no-edit'], effectiveCwd)

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
      console.log(`[DRY RUN] Would generate changelog ${versionRange} and amend to commit`)
    }

    // Create git tag AFTER changelog generation (if requested)
    if (tag && lastNewVersion && !dryRun) {
      try {
        // Format the tag name - either use the provided format or default to vX.Y.Z
        const tagName = typeof tag === 'string'
          ? tag.replace('{version}', lastNewVersion).replace('%s', lastNewVersion)
          : `v${lastNewVersion}`

        // Format the tag message if provided
        const finalTagMessage = tagMessage
          ? tagMessage.replace('{version}', lastNewVersion).replace('%s', lastNewVersion)
          : `Release ${lastNewVersion}`

        // Check if tag exists before attempting to create it
        // We already do this in createGitTag, but we want to catch the error here
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
      catch {
        // Prevent this error from causing the full rollback handling in the main catch block
        // Mark this error as already handled
        // const errorMessage = tagError instanceof Error ? tagError.message : String(tagError)
        const handledError = new Error(`Git tag for version ${lastNewVersion} already exists. Use a different version.`)

        // Mark as handled to prevent duplicate error messages
        const handledSymbol = Symbol.for('bumpx.errorHandled')
        ;(handledError as any)[handledSymbol] = true

        // Throw the handled error to stop processing but avoid duplicate messages
        throw handledError
      }
    }
    else if (tag && !dryRun && lastNewVersion && !inGitRepo) {
      console.warn('Warning: Requested to create a git tag but current directory is not a Git repository. Skipping tag...')
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
    if (changelog && !commit && lastNewVersion && !dryRun && inGitRepo) {
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

    if (push && !dryRun && inGitRepo) {
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
    else if (push && !dryRun && !inGitRepo) {
      console.warn('Warning: Requested to push to remote but current directory is not a Git repository. Skipping push...')
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
      await rollbackChanges(fileBackups, hasStartedGitOperations, effectiveCwd)
      console.log('Rollback completed. No changes were made.')
      throw error
    }

    // For other errors, attempt rollback if we've made changes
    if (hasStartedUpdates && fileBackups.size > 0) {
      console.log('\nRolling back changes due to error...')
      await rollbackChanges(fileBackups, hasStartedGitOperations, effectiveCwd)
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
      // Remove the "# Changelog" header from existing content to avoid duplication
      existingContent = existingContent.replace(/^# Changelog\s*\n/, '')
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
    // In test mode, skip the module import and go straight to CLI
    const isTestMode = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test' || process.argv.includes('test')
    if (!isTestMode) {
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
    else {
      // Use CLI approach in test mode
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
  }
  catch (error: any) {
    // If logsmith is not available or fails, try using the CLI command as fallback
    try {
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
async function rollbackChanges(fileBackups: Map<string, { content: string, version: string }>, hasStartedGitOperations: boolean = false, cwd?: string): Promise<void> {
  // First, unstage any staged changes if Git operations were started
  if (hasStartedGitOperations) {
    try {
      const { executeGit } = await import('./utils')
      executeGit(['reset', 'HEAD'], cwd || process.cwd())
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
async function promptForVersion(currentVersion: string, preid?: string, cwd?: string, dryRun?: boolean): Promise<string | never> {
  // Check for interruption first
  if (userInterrupted.value) {
    // Let the global handler show message
    process.exit(0)
  }

  // Prevent prompting during tests to avoid hanging
  if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test' || process.argv.includes('test') || process.argv.some(arg => arg.includes('test'))) {
    // In test mode, just return a simulated patch increment
    return incrementVersion(currentVersion, 'patch', preid)
  }

  // Default to a patch version increment
  const patchVersion = incrementVersion(currentVersion, 'patch', preid)

  // Save original SIGINT handlers
  const originalSigIntHandlers = process.listeners('SIGINT').slice()
  let cancelled = false
  let selectedVersion = patchVersion

  // Enhanced Ctrl+C handling for the prompt
  // This will completely abort the process
  const sigintHandler = () => {
    cancelled = true
    userInterrupted.value = true
    // Let the global handler in bin/cli.ts handle the message
    // Force process exit immediately with success code
    process.exit(0)
  }

  try {
    // Generate options for version selection
    const options: Array<{ value: string, label: string }> = []

    // Check if tags exist for each version type before offering them
    const { gitTagExists } = await import('./utils')
    const effectiveCwd = cwd || process.cwd()

    // Helper to check tag existence
    const checkTagExists = (version: string): boolean => {
      try {
        const tagName = `v${version}`
        return gitTagExists(tagName, effectiveCwd)
      }
      catch {
        // If we can't check, assume it doesn't exist
        return false
      }
    }

    // Try to add each version type, checking if tags already exist
    const tryAddVersion = (type: string, versionCalc: () => string) => {
      try {
        const calculatedVersion = versionCalc()
        const tagExists = checkTagExists(calculatedVersion)
        if (tagExists) {
          // Tag exists, mark it as unavailable
          options.push({ value: `${type}-exists`, label: `${type} ${calculatedVersion} (tag exists)` })
        }
        else {
          // Tag doesn't exist, add as normal option
          options.push({ value: type, label: `${type} ${calculatedVersion}` })
        }
      }
      catch {}
    }

    tryAddVersion('patch', () => incrementVersion(currentVersion, 'patch', preid))
    tryAddVersion('minor', () => incrementVersion(currentVersion, 'minor', preid))
    tryAddVersion('major', () => incrementVersion(currentVersion, 'major', preid))
    tryAddVersion('prepatch', () => incrementVersion(currentVersion, 'prepatch', preid))
    tryAddVersion('preminor', () => incrementVersion(currentVersion, 'preminor', preid))
    tryAddVersion('premajor', () => incrementVersion(currentVersion, 'premajor', preid))
    tryAddVersion('prerelease', () => incrementVersion(currentVersion, 'prerelease', preid))

    // Add custom option
    options.push({ value: 'custom', label: 'custom...' })

    // Replace default handlers with our aggressive one
    process.removeAllListeners('SIGINT')
    process.on('SIGINT', sigintHandler)

    // Check if already interrupted
    if (userInterrupted.value || cancelled) {
      // Let the process.exit trigger the global handler
      process.exit(0)
    }

    // Show selection prompt with custom cancel handling
    let choice
    try {
      // Dynamic import to avoid top-level import issues
      const clappModule: any = await import('@stacksjs/clapp')
      const select = clappModule.select || clappModule.default?.select || clappModule.CLI?.select
      const text = clappModule.text || clappModule.default?.text || clappModule.CLI?.text

      if (!select || !text) {
        throw new Error('Unable to import interactive prompt functions from @stacksjs/clapp')
      }

      const promptMessage = dryRun ? '[DRY RUN] Choose an option:' : 'Choose an option:'
      choice = await select({
        message: promptMessage,
        options,
        onCancel: () => {
          cancelled = true
          userInterrupted.value = true
          // Use stderr.write to ensure message is displayed before process exit
          process.stderr.write('\nVersion bump cancelled by user \x1B[3m(Ctrl+C)\x1B[0m\n')
          // Force immediate exit with success code
          process.exit(0)
          return undefined // This never executes but is here for type safety
        },
      })

      // Double-check for interruption
      if (userInterrupted.value || cancelled) {
        // Let global handler show message
        process.exit(0)
      }

      // Handle null/undefined (cancellation)
      if (choice === null || choice === undefined) {
        // User cancelled - exit immediately
        process.stderr.write('\nVersion bump cancelled by user\n')
        process.exit(0)
      }

      // Check for interruption before processing any choice
      if (userInterrupted.value || cancelled) {
        process.stderr.write('\nVersion bump cancelled by user\n')
        process.exit(0)
      }

      // Handle Symbol or numeric selection
      if (typeof choice === 'symbol' || typeof choice === 'number') {
        // This is likely a keyboard selection or symbol
        const selectedIndex = typeof choice === 'number' ? choice : 0
        const symbolStr = String(choice)

        // Check for SIGINT symbol
        if (symbolStr.includes('SIGINT') || symbolStr.includes('interrupt')) {
          // User interrupted - exit immediately
          process.stderr.write('\nVersion bump cancelled by user\n')
          process.exit(0)
        }

        // Check for interruption again before processing selection
        if (userInterrupted.value || cancelled) {
          process.stderr.write('\nVersion bump cancelled by user\n')
          process.exit(0)
        }

        if (selectedIndex >= 0 && selectedIndex < options.length) {
          const selectedOption = options[selectedIndex]
          if (selectedOption.value === 'custom') {
            // Custom version input below
          }
          else {
            // Check one more time before returning version
            if (userInterrupted.value || cancelled) {
              process.stderr.write('\nVersion bump cancelled by user\n')
              process.exit(0)
            }
            // Return directly with calculated version
            return incrementVersion(currentVersion, selectedOption.value as any, preid)
          }
        }
        else {
          // Out of bounds or unrecognizable selection - exit instead of fallback
          process.stderr.write('\nInvalid selection - cancelling operation\n')
          process.exit(1)
        }
      }

      // Check for interruption before processing string choices
      if (userInterrupted.value || cancelled) {
        process.stderr.write('\nVersion bump cancelled by user\n')
        process.exit(0)
      }

      // Handle string-based selections
      const choiceStr = String(choice)

      // Check if a version with existing tag was selected
      if (choiceStr.endsWith('-exists')) {
        console.log('\nError: The selected version has an existing Git tag. Choose a different version.')
        // Return to prompt recursively
        return promptForVersion(currentVersion, preid, cwd, dryRun)
      }

      if (choiceStr === 'custom') {
        // Custom version input
        const customMessage = dryRun ? '[DRY RUN] Enter the new version number:' : 'Enter the new version number:'
        const rawInput = await text({
          message: customMessage,
          placeholder: currentVersion,
          onCancel: () => {
            cancelled = true
            userInterrupted.value = true
            // Use stderr.write to ensure message is displayed before process exit
            process.stderr.write('\nVersion bump cancelled by user \x1B[3m(Ctrl+C)\x1B[0m\n')
            // Force immediate exit with success code
            process.exit(0)
            return undefined // This never executes but is here for type safety
          },
        })

        const input = rawInput?.trim()

        if (!input) {
          // Empty input - user cancelled
          process.stderr.write('\nVersion bump cancelled by user\n')
          process.exit(0)
        }

        // Use our own validation from the isValidVersion function
        try {
          // Attempt to validate the version
          if (!isValidVersion(input)) {
            console.error(`'${input}' is not a valid semantic version!`)
            process.exit(1)
          }
        }
        catch {
          console.error(`'${input}' is not a valid semantic version!`)
          process.exit(1)
        }

        // Set valid custom version
        selectedVersion = input
      }
      else {
        // Check for interruption before final version calculation
        if (userInterrupted.value || cancelled) {
          process.stderr.write('\nVersion bump cancelled by user\n')
          process.exit(0)
        }
        // Standard version increment based on selection
        selectedVersion = incrementVersion(currentVersion, choiceStr as any, preid)
      }
    }
    catch (error: any) {
      // Handle errors from the prompt itself
      if (error.message?.includes('cancelled') || error.message?.includes('interrupted')) {
        process.stderr.write('\nVersion bump cancelled by user\n')
        process.exit(0)
      }
      throw error
    }

    return selectedVersion
  }
  catch (error: any) {
    // Don't fallback to patch increment on cancellation - exit immediately
    if (error.message?.includes('cancelled') || error.message?.includes('interrupted')) {
      process.stderr.write('\nVersion bump cancelled by user\n')
      process.exit(0)
    }

    // For other errors, provide a helpful message and exit
    console.error('Error: Version selection failed:', error.message || error)
    process.exit(1)
  }
  finally {
    // Always restore original signal handlers
    process.removeAllListeners('SIGINT')
    for (const handler of originalSigIntHandlers) {
      process.on('SIGINT', handler)
    }
  }
}
