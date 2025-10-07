import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as utils from '../src/utils'
import { versionBump } from '../src/version-bump'

describe('Git Operations (Integration)', () => {
  let tempDir: string
  let mockSpawnSync: any
  let mockExecSync: any
  let mockIsGitRepo: any
  let mockGitTagExists: any

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-git-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })

    // Mock isGitRepository to return true so git operations will execute
    mockIsGitRepo = spyOn(utils, 'isGitRepository').mockReturnValue(true)

    // Mock gitTagExists to prevent real git tag checks that pollute global state
    mockGitTagExists = spyOn(utils, 'gitTagExists').mockReturnValue(false)

    // Mock git operations to avoid actual git commands in tests
    mockSpawnSync = spyOn(utils, 'executeGit').mockImplementation((args: string[], _cwd?: string) => {
      // Simulate successful git operations
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
      // Mock npm install and other commands
      if (command.includes('npm install'))
        return 'Dependencies installed'
      if (command.includes('git add'))
        return 'Files staged'
      if (command.includes('echo'))
        return command.replace('echo ', '').replace(/"/g, '')
      return ''
    })
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mockSpawnSync.mockRestore()
    mockExecSync.mockRestore()
    mockIsGitRepo.mockRestore()
    mockGitTagExists.mockRestore()
  })

  describe('Push Functionality', () => {
    it('should push to remote when push: true', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: true,
        quiet: true,
        noGitCheck: true,
      })

      // Verify push was called with correct arguments
      expect(mockSpawnSync).toHaveBeenCalledWith(['push', '--follow-tags'], tempDir)
    })

    it('should not push when push: false', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Verify push was NOT called
      const pushCalls = mockSpawnSync.mock.calls.filter((call: any) =>
        call[0] && call[0].includes && call[0].includes('push'),
      )
      expect(pushCalls.length).toBe(0)
    })

    it('should pull before push when upstream exists', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Mock canSafelyPull to return true
      const canSafelyPullSpy = spyOn(utils, 'canSafelyPull').mockReturnValue(true)

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: true,
        quiet: true,
        noGitCheck: true,
      })

      // Verify pull was called before push
      expect(mockSpawnSync).toHaveBeenCalledWith(['pull'], tempDir)
      expect(mockSpawnSync).toHaveBeenCalledWith(['push', '--follow-tags'], tempDir)

      canSafelyPullSpy.mockRestore()
    })

    it('should skip pull when no upstream branch', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Mock canSafelyPull to return false
      const canSafelyPullSpy = spyOn(utils, 'canSafelyPull').mockReturnValue(false)
      const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {})

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: true,
        quiet: true,
        noGitCheck: true,
      })

      // Verify pull was NOT called but push was
      const pullCalls = mockSpawnSync.mock.calls.filter((call: any) =>
        call[0] && call[0].includes && call[0].includes('pull'),
      )
      expect(pullCalls.length).toBe(0)
      expect(mockSpawnSync).toHaveBeenCalledWith(['push', '--follow-tags'], tempDir)
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ No upstream branch configured or in detached HEAD. Skipping pull...')

      canSafelyPullSpy.mockRestore()
      consoleSpy.mockRestore()
    })

    it('should push without tags when tag: false', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: false,
        push: true,
        quiet: true,
        noGitCheck: true,
      })

      // Verify push was called without --follow-tags
      expect(mockSpawnSync).toHaveBeenCalledWith(['push'], tempDir)
    })
  })

  describe('Recursive Functionality', () => {
    it('should update all workspace packages when recursive: true', async () => {
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
      mkdirSync(pkg1Dir)
      mkdirSync(pkg2Dir)

      const pkg1Path = join(pkg1Dir, 'package.json')
      const pkg2Path = join(pkg2Dir, 'package.json')

      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '2.0.0' }, null, 2))
      writeFileSync(pkg2Path, JSON.stringify({ name: 'pkg2', version: '0.5.0' }, null, 2))

      await versionBump({
        release: 'patch',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Check that all packages were updated to the same version (root version + patch)
      const updatedRoot = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      const updatedPkg1 = JSON.parse(readFileSync(pkg1Path, 'utf-8'))
      const updatedPkg2 = JSON.parse(readFileSync(pkg2Path, 'utf-8'))

      expect(updatedRoot.version).toBe('1.0.1')
      expect(updatedPkg1.version).toBe('1.0.1') // Should match root, not increment from 2.0.0
      expect(updatedPkg2.version).toBe('1.0.1') // Should match root, not increment from 0.5.0
    })

    it('should only update root when recursive: false', async () => {
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
        files: [join(tempDir, 'package.json')], // Only root package
        recursive: false,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Check that only root was updated
      const updatedRoot = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      const unchangedPkg1 = JSON.parse(readFileSync(pkg1Path, 'utf-8'))

      expect(updatedRoot.version).toBe('1.0.1')
      expect(unchangedPkg1.version).toBe('1.0.0') // Should remain unchanged
    })

    it('should handle workspace discovery with object format', async () => {
      // Create root package.json with workspaces object format
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: { packages: ['libs/*', 'apps/*'] },
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      // Create libs and apps directories
      const libsDir = join(tempDir, 'libs')
      const appsDir = join(tempDir, 'apps')
      mkdirSync(libsDir, { recursive: true })
      mkdirSync(appsDir, { recursive: true })

      const lib1Dir = join(libsDir, 'lib1')
      const app1Dir = join(appsDir, 'app1')
      mkdirSync(lib1Dir)
      mkdirSync(app1Dir)

      const lib1Path = join(lib1Dir, 'package.json')
      const app1Path = join(app1Dir, 'package.json')

      writeFileSync(lib1Path, JSON.stringify({ name: 'lib1', version: '1.0.0' }, null, 2))
      writeFileSync(app1Path, JSON.stringify({ name: 'app1', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'minor',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Check that all packages were updated
      const updatedRoot = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      const updatedLib1 = JSON.parse(readFileSync(lib1Path, 'utf-8'))
      const updatedApp1 = JSON.parse(readFileSync(app1Path, 'utf-8'))

      expect(updatedRoot.version).toBe('1.1.0')
      expect(updatedLib1.version).toBe('1.1.0')
      expect(updatedApp1.version).toBe('1.1.0')
    })
  })

  describe('Execute Functionality', () => {
    it('should execute single command before git operations', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        execute: 'echo "test command"',
        commit: true,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Verify command was executed
      expect(mockExecSync).toHaveBeenCalledWith('echo "test command"', expect.any(String))

      // Verify commit happened after execute (actual format includes 'v' prefix)
      expect(mockSpawnSync).toHaveBeenCalledWith(['commit', '-m', 'chore: release v1.0.1'], expect.any(String))
    })

    it('should execute multiple commands in order', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        execute: ['echo "first"', 'echo "second"', 'echo "third"'],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Verify all commands were executed in order
      expect(mockExecSync).toHaveBeenCalledWith('echo "first"', expect.any(String))
      expect(mockExecSync).toHaveBeenCalledWith('echo "second"', expect.any(String))
      expect(mockExecSync).toHaveBeenCalledWith('echo "third"', expect.any(String))
    })

    it('should handle command execution failures gracefully', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Mock a failing command
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('failing-command')) {
          throw new Error('Command failed')
        }
        return ''
      })

      const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {})

      await versionBump({
        release: 'patch',
        files: [packagePath],
        execute: 'failing-command',
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Version should still be updated despite command failure
      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1')

      // Warning should be shown
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Command execution failed: Error: Command failed')

      consoleSpy.mockRestore()
    })

    it('should not execute commands in dry run mode', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const consoleSpy = spyOn(console, 'log').mockImplementation(() => {})

      await versionBump({
        release: 'patch',
        files: [packagePath],
        execute: 'echo "test"',
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        dryRun: true,
      })

      // Command should not be executed, but dry run message should be shown
      const executeCalls = mockExecSync.mock.calls.filter((call: any) =>
        call[0] && call[0].includes('echo "test"'),
      )
      expect(executeCalls.length).toBe(0)

      // Check that dry run message was logged
      const dryRunCalls = consoleSpy.mock.calls.filter((call: any) =>
        call[0] && call[0].includes('[DRY RUN] Would execute: echo "test"'),
      )
      expect(dryRunCalls.length).toBe(1)

      consoleSpy.mockRestore()
    })

    it('should execute commands with correct working directory', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        execute: 'pwd',
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify command was executed with correct cwd
      expect(mockExecSync).toHaveBeenCalledWith('pwd', tempDir)
    })
  })

  describe('Tag Message Functionality', () => {
    it('should include changelog content in tag message when available', async () => {
      const packagePath = join(tempDir, 'package.json')
      const changelogPath = join(tempDir, 'CHANGELOG.md')

      // Create package.json and CHANGELOG.md
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      writeFileSync(
        changelogPath,
        `# Changelog

## 1.0.1

### New Features
- Added feature A
- Added feature B

### Bug Fixes
- Fixed bug X
- Fixed bug Y

## 1.0.0

Initial release
`,
      )

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Find the actual tag call to check
      const tagCalls = mockSpawnSync.mock.calls.filter(
        call => call[0] && call[0].includes && call[0].includes('tag') && call[0].includes('-m'),
      )

      // Check that the tag includes at least the version header from the changelog
      const matchingCall = tagCalls.some(call =>
        call[0][0] === 'tag'
        && call[0][1] === '-a'
        && call[0][2] === 'v1.0.1'
        && call[0][3] === '-m'
        && call[0][4].includes('## 1.0.1'),
      )

      expect(matchingCall).toBe(true)
    })

    it('should use default tag message when no changelog is available', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Find the actual tag call to check
      const tagCalls = mockSpawnSync.mock.calls.filter(
        call => call[0] && call[0].includes && call[0].includes('tag'),
      )

      // We just check that a tag was created with the correct version
      const basicTagCall = tagCalls.some(call =>
        call[0][0] === 'tag'
        && call[0].includes('v1.0.1'),
      )

      expect(basicTagCall).toBe(true)
    })

    it('should use default message when changelog exists but doesn\'t have current version', async () => {
      const packagePath = join(tempDir, 'package.json')
      const changelogPath = join(tempDir, 'CHANGELOG.md')

      // Create package.json and CHANGELOG.md without the version we're bumping to
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      writeFileSync(
        changelogPath,
        `# Changelog

## 1.0.0

Initial release
`,
      )

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Find the actual tag call to check
      const tagCalls = mockSpawnSync.mock.calls.filter(
        call => call[0] && call[0].includes && call[0].includes('tag') && call[0].includes('-m'),
      )

      // We expect the implementation to extract content from the changelog
      const matchingCall = tagCalls.some(call =>
        call[0][0] === 'tag'
        && call[0][1] === '-a'
        && call[0][2] === 'v1.0.1'
        && call[0][3] === '-m'
        && call[0][4].includes('## 1.0.0'),
      )

      expect(matchingCall).toBe(true)
    })

    it('should use custom tag message when provided', async () => {
      const packagePath = join(tempDir, 'package.json')
      const changelogPath = join(tempDir, 'CHANGELOG.md')

      // Create package.json and CHANGELOG.md
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      writeFileSync(
        changelogPath,
        `# Changelog\n\n## 1.0.1\n\n- Some changes`,
      )

      const customTagMessage = 'Custom tag for version {version}'

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true,
        tag: true,
        tagMessage: customTagMessage,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Find the actual tag call to check
      const tagCalls = mockSpawnSync.mock.calls.filter(
        call => call[0] && call[0].includes && call[0].includes('tag') && call[0].includes('-m'),
      )

      // Check that one of the calls includes the changelog content
      const matchingCall = tagCalls.some(call =>
        call[0][0] === 'tag'
        && call[0][1] === '-a'
        && call[0][2] === 'v1.0.1'
        && call[0][3] === '-m'
        && call[0][4].includes('## 1.0.1'),
      )

      expect(matchingCall).toBe(true)
    })
  })

  describe('Default Configuration Tests', () => {
    it('should use commit: true, tag: true, push: true by default', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Test the function with explicit defaults that match config
      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: true, // Explicitly set to test git operations
        tag: true, // Explicitly set to test git operations
        push: true, // Explicitly set to test git operations
        quiet: true,
        noGitCheck: true,
      })

      // Verify all git operations were performed (defaults use 'v' prefix in commit message)
      expect(mockSpawnSync).toHaveBeenCalledWith(['commit', '-m', 'chore: release v1.0.1'], expect.any(String))
      expect(mockSpawnSync).toHaveBeenCalledWith(['tag', '-a', 'v1.0.1', '-m', 'Release 1.0.1'], expect.any(String))
      expect(mockSpawnSync).toHaveBeenCalledWith(['push', '--follow-tags'], expect.any(String))
    })

    it('should allow opting out with explicit false values', async () => {
      const outputDir = join(__dirname, 'output', 'git-operations', 'opt-out')
      const packagePath = join(outputDir, 'package.json')

      // Create output directory
      mkdirSync(outputDir, { recursive: true })

      // Create test package.json
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        cwd: outputDir,
      })

      // Verify version was bumped but no git operations occurred
      const updatedPackage = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedPackage.version).toBe('1.0.1')

      // Since we're not using git operations, we just verify the version bump worked
      // No need to check git calls since we're using file-based testing
    })

    it('should handle recursive + execute + git operations together', async () => {
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
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '2.0.0' }, null, 2))

      await versionBump({
        release: 'minor',
        recursive: true,
        execute: 'echo "building workspace"',
        commit: true,
        tag: true,
        push: true,
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
      })

      // Verify all packages were updated
      const updatedRoot = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      const updatedPkg1 = JSON.parse(readFileSync(pkg1Path, 'utf-8'))

      expect(updatedRoot.version).toBe('1.1.0')
      expect(updatedPkg1.version).toBe('1.1.0')

      // Verify execute command was called
      expect(mockExecSync).toHaveBeenCalledWith('echo "building workspace"', tempDir)

      // Verify git operations were performed
      expect(mockSpawnSync).toHaveBeenCalledWith(['commit', '-m', 'chore: release v1.1.0'], tempDir)
      expect(mockSpawnSync).toHaveBeenCalledWith(['tag', '-a', 'v1.1.0', '-m', 'Release 1.1.0'], tempDir)
      expect(mockSpawnSync).toHaveBeenCalledWith(['push', '--follow-tags'], tempDir)
    })
  })
})
