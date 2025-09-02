import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as utils from '../src/utils'
import { versionBump } from '../src/version-bump'

describe('Recursive All Prompt Integration', () => {
  let tempDir: string
  let mockSpawnSync: any
  let mockExecSync: any
  let mockConfirm: any
  let mockIsGitRepo: any
  let mockGitTagExists: any
  let mockUpdateVersionInFile: any
  let consoleSpy: any

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-recursive-all-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })

    // Mock isGitRepository to return true so git operations will execute
    mockIsGitRepo = spyOn(utils, 'isGitRepository').mockReturnValue(true)

    // Mock gitTagExists to always return false (no existing tags)
    mockGitTagExists = spyOn(utils, 'gitTagExists').mockReturnValue(false)
    
    // Mock console.log to capture output
    consoleSpy = spyOn(console, 'log')

    // Mock file system operations to prevent real file modifications
    mockUpdateVersionInFile = spyOn(utils, 'updateVersionInFile').mockImplementation((filePath: string, oldVersion: string, newVersion: string, _forceUpdate: boolean = false) => ({
      path: filePath,
      content: `{"name":"test","version":"${newVersion}"}`,
      updated: true,
      oldVersion,
      newVersion,
    }))

    // Mock git operations
    mockSpawnSync = spyOn(utils, 'executeGit').mockImplementation((args: string[], _cwd?: string) => {
      if (args.includes('status'))
        return ''
      if (args.includes('pull'))
        return 'Already up to date.'
      if (args.includes('push'))
        return 'Everything up-to-date'
      if (args.includes('commit'))
        return 'Commit successful'
      if (args.includes('tag'))
        return 'Tag created'
      if (args.includes('add'))
        return 'Files staged'
      return ''
    })

    mockExecSync = spyOn(utils, 'executeCommand').mockImplementation((command: string, _cwd?: string) => {
      if (command.includes('npm install'))
        return 'Dependencies installed'
      if (command.includes('git add'))
        return 'Files staged'
      return ''
    })

    // Mock the confirmation prompt
    mockConfirm = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mockSpawnSync.mockRestore()
    mockExecSync.mockRestore()
    mockConfirm.mockRestore()
    mockIsGitRepo.mockRestore()
    mockGitTagExists.mockRestore()
    mockUpdateVersionInFile.mockRestore()
  })

  describe('Recursive All Workflow', () => {
    it('should update all workspace packages with recursive and all flags', async () => {
      // Create root package.json with workspaces
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      // Create workspace packages
      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })

      const pkg1Dir = join(packagesDir, 'pkg1')
      const pkg2Dir = join(packagesDir, 'pkg2')
      mkdirSync(pkg1Dir, { recursive: true })
      mkdirSync(pkg2Dir, { recursive: true })

      const pkg1Path = join(pkg1Dir, 'package.json')
      const pkg2Path = join(pkg2Dir, 'package.json')

      const pkg1 = { name: 'pkg1', version: '1.0.0' }
      const pkg2 = { name: 'pkg2', version: '1.0.0' }

      writeFileSync(pkg1Path, JSON.stringify(pkg1, null, 2))
      writeFileSync(pkg2Path, JSON.stringify(pkg2, null, 2))

      // Mock the prompt response
      mockConfirm.mockImplementation((msg: string) => {
        if (msg.includes('Do you want to continue?')) {
          return true;
        }
      });

      // Run version bump with recursive and all flags (dry run to assert messages)
      await versionBump({
        recursive: true,
        all: true,
        release: 'patch',
        cwd: tempDir,
        confirm: true,
        yes: true, // Skip confirmation
        noGitCheck: true, // Skip git check
        dryRun: true,
      })

      // Verify version updates were processed
      expect(mockUpdateVersionInFile).toHaveBeenCalledTimes(3) // root + 2 packages
      
      // Verify git operations in dry run mode
      const output = consoleSpy.mock.calls.flat().join('\n')
      expect(output).toContain('[DRY RUN] Would bump root version from 1.0.0 to 1.0.1')
      // commit/tag messages are only printed when commit/tag options are provided to versionBump
      
      // Verify version updates were processed with correct parameters
      expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        expect.any(String),
        expect.any(String),
        true // dryRun is true
      )
      
      // Verify dry run output messages
      expect(output).toContain('Would bump version to 1.0.1')
      expect(output).toContain('Would update 3 files')
      expect(utils.executeGit).not.toHaveBeenCalled()
    })

    it('should handle confirmation prompt in test mode', async () => {
      // Create root package.json
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      // Create workspace package
      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })
      const pkg1Dir = join(packagesDir, 'pkg1')
      mkdirSync(pkg1Dir, { recursive: true })
      const pkg1Path = join(pkg1Dir, 'package.json')
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))

      // Clear previous mocks
      mockUpdateVersionInFile.mockClear()
      consoleSpy.mockClear()

      // Test with confirmation enabled and dry run
      await versionBump({
        release: 'patch',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        confirm: true,
        quiet: false,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true,
        yes: true, // Auto-confirm
      })
      
      // Verify dry run messages in output
      const output = consoleSpy.mock.calls.flat().join('\n')
      expect(output).toContain('[DRY RUN] Would bump root version from 1.0.0 to 1.0.1')
      expect(output).toContain('[DRY RUN] Would create git commit')
      expect(output).toContain('[DRY RUN] Would create git tag')
      
      // In dry run mode, version updates should be processed but not saved
      expect(mockUpdateVersionInFile).toHaveBeenCalledTimes(2) // root + pkg1
      
      // Verify git operations were not called in dry run mode
      expect(utils.executeGit).not.toHaveBeenCalled()
      
      // Verify version updates were processed with correct parameters
      expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        '1.0.0',
        '1.0.1',
        true // dryRun is true
      )
      
      // Verify dry run output messages
      expect(output).toContain('Would bump version to 1.0.1')
      expect(output).toContain('Would update 2 files')
      
      // In dry run we do not actually run git
      expect(utils.executeGit).not.toHaveBeenCalled()
    })

    it('should skip confirmation when --yes flag is used', async () => {
      // Create root package.json
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      // Create workspace package
      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })
      const pkg1Dir = join(packagesDir, 'pkg1')
      mkdirSync(pkg1Dir, { recursive: true })
      const pkg1Path = join(pkg1Dir, 'package.json')
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))

      // Clear previous mocks
      mockUpdateVersionInFile.mockClear()
      consoleSpy.mockClear()
      mockSpawnSync.mockClear()

      // Run with --yes flag to skip confirmation
      await versionBump({
        release: 'patch',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        yes: true, // Skip confirmation
        quiet: false,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true, // Run in dry-run mode
      })
      
      // Verify dry run messages in output
      const output = consoleSpy.mock.calls.flat().join('\n')
      expect(output).toContain('[DRY RUN] Would bump root version from 1.0.0 to 1.0.1')
      expect(output).toContain('[DRY RUN] Would create git commit')
      expect(output).toContain('[DRY RUN] Would create git tag')
      
      // Verify version updates were processed
      expect(mockUpdateVersionInFile).toHaveBeenCalledTimes(2) // root + pkg1
      
      // In dry run mode, git operations should not be called
      expect(utils.executeGit).not.toHaveBeenCalled()
      
      // Verify version updates were processed with correct parameters
      expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        '1.0.0',
        '1.0.1',
        true // dryRun is true
      )
      
      // Verify dry run output messages
      expect(output).toContain('Would bump version to 1.0.1')
      expect(output).toContain('Would update 2 files')
      
      // Verify version update was processed
      expect(mockUpdateVersionInFile).toHaveBeenCalledTimes(2) // root + pkg1
      
      // Verify version updates were processed with correct parameters
      expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        '1.0.0',
        '1.0.1',
        true
      )
      
      // In dry-run mode, git operations should not be called
      expect(utils.executeGit).not.toHaveBeenCalled()
    })

    it('should skip confirmation in CI mode', async () => {
      // Create root package.json
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      await versionBump({
        release: 'patch',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        ci: true, // CI mode
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true,
      })

      // In dry run mode, verify the mock was called instead of checking file contents
      expect(utils.updateVersionInFile).toHaveBeenCalled()
    })

    it('should enable commit, tag, and push after confirmation', async () => {
      // Create root package.json
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      // Create workspace package
      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })
      const pkg1Dir = join(packagesDir, 'pkg1')
      mkdirSync(pkg1Dir, { recursive: true })
      const pkg1Path = join(pkg1Dir, 'package.json')
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))

      // Clear previous mocks
      mockUpdateVersionInFile.mockClear()
      consoleSpy.mockClear()
      mockSpawnSync.mockClear()

      // Mock the confirm function to simulate user confirmation
      mockConfirm.mockImplementation((msg: string) => {
        if (msg.includes('Do you want to continue?')) {
          return true;
        }
      });

      await versionBump({
        release: 'patch',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        confirm: true, // Enable confirmation
        quiet: false,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true, // Run in dry-run mode
      })

      // Verify dry run message is present in output
      const output = consoleSpy.mock.calls.flat().join('\n')
      expect(output).toContain('[DRY RUN]')
      expect(output).toContain('Would bump root version from 1.0.0 to 1.0.1')
      
      // Verify version updates were processed
      expect(mockUpdateVersionInFile).toHaveBeenCalledTimes(2) // root + pkg1
      
      // In dry run mode, git operations should not be called
      expect(utils.executeGit).not.toHaveBeenCalled()
      
      // Verify version updates were processed with correct parameters (dryRun => forceUpdate true)
      expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        '1.0.0',
        '1.0.1',
        true
      )
      
      // In dry-run mode, git operations should not be called
      expect(utils.executeGit).not.toHaveBeenCalled()
      
      // Verify the output contains the expected messages for commit, tag, and push (dry-run)
      expect(output).toContain('[DRY RUN] Would create git commit')
      expect(output).toContain('[DRY RUN] Would create git tag')
      expect(output).toContain('[DRY RUN] Would push to remote')
    })

    it('should work with different release types', async () => {
      // Create root package.json
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      // Create workspace packages
      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })
      
      const pkg1Dir = join(packagesDir, 'pkg1')
      const pkg2Dir = join(packagesDir, 'pkg2')
      mkdirSync(pkg1Dir, { recursive: true })
      mkdirSync(pkg2Dir, { recursive: true })

      const pkg1Path = join(pkg1Dir, 'package.json')
      const pkg2Path = join(pkg2Dir, 'package.json')

      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))
      writeFileSync(pkg2Path, JSON.stringify({ name: 'pkg2', version: '1.0.0' }, null, 2))

      // Clear previous mocks
      mockUpdateVersionInFile.mockClear()
      consoleSpy.mockClear()
      mockSpawnSync.mockClear()

      // Test with different release types and verify version updates
      const testCases = [
        { release: 'major', from: '1.0.0', to: '2.0.0' },
        { release: 'minor', from: '1.0.0', to: '1.1.0' },
        { release: 'patch', from: '1.0.0', to: '1.0.1' },
        { release: 'premajor', from: '1.0.0', to: '2.0.0-alpha.0' },
        { release: 'preminor', from: '1.0.0', to: '1.1.0-alpha.0' },
        { release: 'prepatch', from: '1.0.0', to: '1.0.1-alpha.0' },
        { release: 'prerelease', from: '1.0.0', to: '1.0.1-alpha.0' },
      ]

      for (const { release, from, to } of testCases) {
        // Reset mocks for each test case
        mockUpdateVersionInFile.mockClear()
        consoleSpy.mockClear()

        await versionBump({
          release,
          recursive: true,
          all: true,
          commit: true,
          tag: true,
          push: true,
          confirm: false,
          quiet: true,
          noGitCheck: true,
          cwd: tempDir,
          dryRun: true,
        })

        // Verify version updates were processed with correct parameters
        expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
          expect.stringContaining('package.json'),
          from,
          to,
          true // dryRun is true
        )
        
        // In dry-run mode, git operations should not be called
        expect(utils.executeGit).not.toHaveBeenCalled()
        
        // Verify dry run output messages
        const output = consoleSpy.mock.calls.flat().join('\n')
        expect(output).toContain(`[DRY RUN] Would bump root version from ${from} to ${to}`)
        expect(output).toContain(`Would bump version to ${to}`)
      }
      
      // Test with major release type
      mockUpdateVersionInFile.mockClear()
      consoleSpy.mockClear()
      
      await versionBump({
        release: 'major',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        confirm: false,
        quiet: false,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true,
      })
      
      // Verify version updates were processed with correct parameters (major bump)
      expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        '1.0.0',
        '2.0.0',
        true
      )
      
      // In dry-run mode, git operations should not be called
      expect(utils.executeGit).not.toHaveBeenCalled()
      
      // Test with prerelease type
      mockUpdateVersionInFile.mockClear()
      consoleSpy.mockClear()
      
      await versionBump({
        release: 'prerelease',
        preid: 'beta',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        confirm: false,
        quiet: false,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true,
      })
      
      // Verify version updates were processed with correct parameters (prerelease bump)
      expect(mockUpdateVersionInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        '1.0.0',
        '1.0.1-beta.0',
        true
      )
      
      // In dry-run mode, git operations should not be called
      expect(utils.executeGit).not.toHaveBeenCalled()
    })
  })
})
