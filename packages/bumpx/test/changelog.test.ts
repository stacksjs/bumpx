import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as utils from '../src/utils'
import { versionBump } from '../src/version-bump'

describe('Changelog Generation', () => {
  let tempDir: string
  let mockSpawnSync: any
  let mockExecSync: any

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-changelog-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })

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
      if (command.includes('bunx logsmith'))
        return 'Changelog generated'
      return ''
    })

    // Mock console methods to avoid cluttering test output
    spyOn(console, 'log').mockImplementation(() => {})
    spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mockSpawnSync.mockRestore()
    mockExecSync.mockRestore()
    spyOn(console, 'log').mockRestore()
    spyOn(console, 'warn').mockRestore()
  })

  describe('Changelog Flag Behavior', () => {
    it('should generate changelog when flag is enabled (default)', async () => {
      const fixtureDir = join(__dirname, 'fixtures', 'changelog-generation')
      const outputDir = join(__dirname, 'output', 'changelog-generation')
      const packagePath = join(outputDir, 'package.json')

      // Create output directory
      mkdirSync(outputDir, { recursive: true })

      // Copy fixture to output directory
      const fixturePackage = readFileSync(join(fixtureDir, 'package.json'), 'utf-8')
      writeFileSync(packagePath, fixturePackage)

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: outputDir,
      })

      // Verify changelog file was created
      const changelogPath = join(outputDir, 'CHANGELOG.md')
      expect(existsSync(changelogPath)).toBe(true)

      // Verify package.json was updated
      const updatedPackage = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedPackage.version).toBe('1.0.1')
    })

    it('should not generate changelog when flag is disabled', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        changelog: false, // Explicitly disabled
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify changelog generation was NOT attempted
      const changelogCalls = mockExecSync.mock.calls.filter((call: any) =>
        call[0] && call[0].includes && call[0].includes('logsmith'),
      )
      expect(changelogCalls.length).toBe(0)
    })

    it('should generate changelog with commit disabled', async () => {
      const fixtureDir = join(__dirname, 'fixtures', 'changelog-generation')
      const outputDir = join(__dirname, 'output', 'changelog-generation', 'commit-disabled')
      const packagePath = join(outputDir, 'package.json')

      // Create output directory
      mkdirSync(outputDir, { recursive: true })

      // Copy fixture to output directory
      const fixturePackage = readFileSync(join(fixtureDir, 'package.json'), 'utf-8')
      writeFileSync(packagePath, fixturePackage)

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false, // Commit disabled
        tag: true,
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: outputDir,
      })

      // Verify version bump completed successfully
      const updatedPackage = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedPackage.version).toBe('1.0.1')

      // Verify changelog file was created
      const changelogPath = join(outputDir, 'CHANGELOG.md')
      expect(existsSync(changelogPath)).toBe(true)
    })

    it('should generate changelog with tag disabled', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: false, // Tag disabled
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify changelog generation was attempted even with tag disabled (using HEAD)
      expect(mockExecSync).toHaveBeenCalledWith('bunx logsmith --output CHANGELOG.md --from v1.0.0 --to HEAD', tempDir)
    })

    it('should generate changelog and commit it when commit is enabled', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true, // Commit enabled
        tag: true,
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify changelog generation was attempted with version range (using HEAD since tag doesn't exist yet)
      expect(mockExecSync).toHaveBeenCalledWith('bunx logsmith --output CHANGELOG.md --from v1.0.0 --to HEAD', tempDir)

      // Verify all files were staged together (no separate changelog staging)
      expect(mockSpawnSync).toHaveBeenCalledWith(['add', '-A'], tempDir)

      // Verify single commit was created (no separate changelog commit)
      expect(mockSpawnSync).toHaveBeenCalledWith(['commit', '-m', 'chore: release v1.0.1'], tempDir)

      // Verify changelog was amended to the commit
      expect(mockSpawnSync).toHaveBeenCalledWith(['add', 'CHANGELOG.md'], tempDir)
      expect(mockSpawnSync).toHaveBeenCalledWith(['commit', '--amend', '--no-edit'], tempDir)
    })

    it('should generate changelog after commit and amend it when commit is enabled', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify changelog generation was attempted with version range (using HEAD since tag doesn't exist yet)
      expect(mockExecSync).toHaveBeenCalledWith('bunx logsmith --output CHANGELOG.md --from v1.0.0 --to HEAD', tempDir)

      // Verify changelog was amended to the commit
      expect(mockSpawnSync).toHaveBeenCalledWith(['add', 'CHANGELOG.md'], tempDir)
      expect(mockSpawnSync).toHaveBeenCalledWith(['commit', '--amend', '--no-edit'], tempDir)
    })
  })

  describe('Changelog Generation Order', () => {
    it('should generate changelog after commit and tag creation, then amend to commit', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const executionOrder: string[] = []

      // Mock git operations to track execution order
      mockSpawnSync.mockImplementation((args: string[]) => {
        if (args[0] === 'commit' && !args.includes('--amend')) {
          executionOrder.push('commit')
        }
        else if (args[0] === 'commit' && args.includes('--amend')) {
          executionOrder.push('amend')
        }
        else if (args[0] === 'tag') {
          executionOrder.push('tag')
        }
        else if (args[0] === 'push') {
          executionOrder.push('push')
        }
        else if (args[0] === 'add' && args.includes('CHANGELOG.md')) {
          executionOrder.push('add-changelog')
        }
        return { status: 0, stdout: '', stderr: '' }
      })

      // Mock changelog generation
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('logsmith')) {
          executionOrder.push('changelog-generation')
        }
        return ''
      })

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: true,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify execution order: commit -> changelog-generation -> add-changelog -> amend -> tag -> push
      expect(executionOrder).toContain('commit')
      expect(executionOrder).toContain('changelog-generation')
      expect(executionOrder).toContain('add-changelog')
      expect(executionOrder).toContain('amend')
      expect(executionOrder).toContain('tag')
      expect(executionOrder).toContain('push')

      // Verify correct order
      const commitIndex = executionOrder.indexOf('commit')
      const changelogIndex = executionOrder.indexOf('changelog-generation')
      const addChangelogIndex = executionOrder.indexOf('add-changelog')
      const amendIndex = executionOrder.indexOf('amend')
      const tagIndex = executionOrder.indexOf('tag')
      const pushIndex = executionOrder.indexOf('push')

      expect(commitIndex).toBeLessThan(changelogIndex)
      expect(changelogIndex).toBeLessThan(addChangelogIndex)
      expect(addChangelogIndex).toBeLessThan(amendIndex)
      expect(amendIndex).toBeLessThan(tagIndex)
      expect(tagIndex).toBeLessThan(pushIndex)
    })
  })

  describe('Dry Run Mode', () => {
    it('should show changelog generation in dry run mode', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const consoleSpy = spyOn(console, 'log').mockImplementation(() => {})

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        changelog: true,
        dryRun: true, // Dry run mode
        quiet: false, // Enable output to see dry run messages
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify dry run message for changelog
      const dryRunCalls = consoleSpy.mock.calls.filter((call: any) =>
        call[0] && call[0].includes('[DRY RUN] Would generate changelog'),
      )
      expect(dryRunCalls.length).toBe(1)

      // Verify actual changelog generation was NOT attempted
      const changelogCalls = mockExecSync.mock.calls.filter((call: any) =>
        call[0] && call[0].includes && call[0].includes('logsmith'),
      )
      expect(changelogCalls.length).toBe(0)

      consoleSpy.mockRestore()
    })

    it('should not show changelog message in dry run when disabled', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const consoleSpy = spyOn(console, 'log').mockImplementation(() => {})

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        changelog: false, // Disabled
        dryRun: true,
        quiet: false,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify no dry run message for changelog
      const dryRunCalls = consoleSpy.mock.calls.filter((call: any) =>
        call[0] && call[0].includes('[DRY RUN] Would generate changelog'),
      )
      expect(dryRunCalls.length).toBe(0)

      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle changelog generation failures gracefully', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Mock changelog generation to fail
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('logsmith')) {
          throw new Error('Changelog generation failed')
        }
        return ''
      })

      const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {})

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Failed to generate changelog:'),
        expect.any(Error),
      )

      // Verify version bump still succeeded despite changelog failure
      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1')

      consoleSpy.mockRestore()
    })
  })

  describe('Progress Reporting', () => {
    it('should report changelog generation progress', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const progressEvents: any[] = []
      const progressCallback = (progress: any) => {
        progressEvents.push(progress)
      }

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
        progress: progressCallback,
      })

      // Verify changelog generation progress event was reported
      const changelogEvents = progressEvents.filter(event =>
        event.event === 'changelogGenerated',
      )
      expect(changelogEvents.length).toBe(1)
      expect(changelogEvents[0].newVersion).toBe('1.0.1')
    })
  })

  describe('Recursive Mode', () => {
    it('should generate changelog in recursive mode', async () => {
      // Create root package.json with workspaces
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
      mkdirSync(pkg1Dir)
      const pkg1Path = join(pkg1Dir, 'package.json')
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        recursive: true,
        commit: true,
        tag: true,
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify changelog generation was attempted in root directory with version range (using HEAD)
      expect(mockExecSync).toHaveBeenCalledWith('bunx logsmith --output CHANGELOG.md --from v1.0.0 --to HEAD', tempDir)
    })
  })

  describe('Configuration Integration', () => {
    it('should use default changelog setting from config', async () => {
      const { defaultConfig } = await import('../src/config')

      // Verify changelog is enabled by default
      expect(defaultConfig.changelog).toBe(true)
    })

    it('should respect CLI override of changelog setting', async () => {
      const { loadBumpConfig } = await import('../src/config')

      // Test CLI override disabling changelog
      const config = await loadBumpConfig({
        changelog: false,
      })

      expect(config.changelog).toBe(false)
    })
  })
})
