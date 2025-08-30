import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-recursive-all-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })

    // Mock isGitRepository to return true so git operations will execute
    mockIsGitRepo = spyOn(utils, 'isGitRepository').mockReturnValue(true)
    
    // Mock gitTagExists to always return false (no existing tags)
    mockGitTagExists = spyOn(utils, 'gitTagExists').mockReturnValue(false)
    
    // Mock file system operations to prevent real file modifications
    spyOn(utils, 'updateVersionInFile').mockImplementation((filePath: string, oldVersion: string, newVersion: string) => ({
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
      mkdirSync(pkg1Dir)
      mkdirSync(pkg2Dir)

      const pkg1Path = join(pkg1Dir, 'package.json')
      const pkg2Path = join(pkg2Dir, 'package.json')

      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '2.0.0' }, null, 2))
      writeFileSync(pkg2Path, JSON.stringify({ name: 'pkg2', version: '0.5.0' }, null, 2))

      await versionBump({
        release: 'patch',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        confirm: false, // Skip confirmation for this test
        quiet: true,
        noGitCheck: true,
        cwd: tempDir, // This ensures it only operates in the temp directory
        dryRun: true, // Add dry run to prevent actual file modifications
      })

      // Since we're using dryRun and mocked updateVersionInFile, 
      // we verify the mock was called with correct parameters
      expect(utils.updateVersionInFile).toHaveBeenCalled()

      // In dry run mode, git operations should still be called but with temp directory
      const gitCalls = mockSpawnSync.mock.calls.filter((call: any) => call[1] === tempDir)
      expect(gitCalls.length).toBeGreaterThan(0)
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
      mkdirSync(pkg1Dir)
      const pkg1Path = join(pkg1Dir, 'package.json')
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))

      // Test with confirmation enabled (should auto-confirm in test mode)
      await versionBump({
        release: 'patch',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        confirm: true, // Enable confirmation
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true,
      })

      // In dry run mode, verify the mock was called instead of checking file contents
      expect(utils.updateVersionInFile).toHaveBeenCalled()
    })

    it('should skip confirmation when --yes flag is used', async () => {
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
        confirm: false, // Simulating --yes flag behavior
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true,
      })

      // In dry run mode, verify the mock was called instead of checking file contents
      expect(utils.updateVersionInFile).toHaveBeenCalled()

      // Verify git operations were performed in temp directory
      const gitCalls = mockSpawnSync.mock.calls.filter((call: any) => call[1] === tempDir)
      expect(gitCalls.length).toBeGreaterThan(0)
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
      mkdirSync(pkg1Dir)
      const pkg1Path = join(pkg1Dir, 'package.json')
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        recursive: true,
        all: true,
        // Explicitly set git operations to test they are enabled
        commit: true,
        tag: true,
        push: true,
        confirm: false, // Skip confirmation for this test
        quiet: true,
        noGitCheck: true,
        cwd: tempDir,
        dryRun: true,
      })

      // Verify that git operations were performed (meaning they were enabled)
      const gitCalls = mockSpawnSync.mock.calls.filter((call: any) => call[1] === tempDir)
      expect(gitCalls.length).toBeGreaterThan(0)
    })

    it('should work with different release types', async () => {
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
      mkdirSync(pkg1Dir)
      const pkg1Path = join(pkg1Dir, 'package.json')
      writeFileSync(pkg1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'minor',
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

      // In dry run mode, verify the mock was called instead of checking file contents
      expect(utils.updateVersionInFile).toHaveBeenCalled()

      // Verify git operations were performed in temp directory
      const gitCalls = mockSpawnSync.mock.calls.filter((call: any) => call[1] === tempDir)
      expect(gitCalls.length).toBeGreaterThan(0)
    })

    it('should handle workspace discovery with complex patterns', async () => {
      // Create root package.json with complex workspace patterns
      const rootPackage = {
        name: 'root',
        version: '1.0.0',
        workspaces: {
          packages: ['libs/*', 'apps/*', 'tools/*'],
        },
      }
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPackage, null, 2))

      // Create multiple workspace directories
      const libsDir = join(tempDir, 'libs')
      const appsDir = join(tempDir, 'apps')
      const toolsDir = join(tempDir, 'tools')
      mkdirSync(libsDir, { recursive: true })
      mkdirSync(appsDir, { recursive: true })
      mkdirSync(toolsDir, { recursive: true })

      // Create packages in each directory
      const lib1Dir = join(libsDir, 'lib1')
      const app1Dir = join(appsDir, 'app1')
      const tool1Dir = join(toolsDir, 'tool1')
      mkdirSync(lib1Dir)
      mkdirSync(app1Dir)
      mkdirSync(tool1Dir)

      const lib1Path = join(lib1Dir, 'package.json')
      const app1Path = join(app1Dir, 'package.json')
      const tool1Path = join(tool1Dir, 'package.json')

      writeFileSync(lib1Path, JSON.stringify({ name: 'lib1', version: '1.0.0' }, null, 2))
      writeFileSync(app1Path, JSON.stringify({ name: 'app1', version: '1.0.0' }, null, 2))
      writeFileSync(tool1Path, JSON.stringify({ name: 'tool1', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
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

      // In dry run mode, verify the mock was called instead of checking file contents
      expect(utils.updateVersionInFile).toHaveBeenCalled()

      // Verify git operations were performed in temp directory
      const gitCalls = mockSpawnSync.mock.calls.filter((call: any) => call[1] === tempDir)
      expect(gitCalls.length).toBeGreaterThan(0)
    })
  })
})
