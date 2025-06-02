import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bumpConfigDefaults } from '../src/config'
import { incrementVersion, isReleaseType, isValidVersion, SemVer } from '../src/utils'
import { versionBump } from '../src/version-bump'

describe('Integration Tests', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-integration-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir('/') // Change back to root to avoid cleanup issues
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('SemVer functionality', () => {
    it('should correctly parse and increment versions', () => {
      const version = new SemVer('1.2.3')
      expect(version.major).toBe(1)
      expect(version.minor).toBe(2)
      expect(version.patch).toBe(3)

      expect(version.inc('patch').toString()).toBe('1.2.4')
      expect(version.inc('minor').toString()).toBe('1.3.0')
      expect(version.inc('major').toString()).toBe('2.0.0')
    })

    it('should handle prerelease versions', () => {
      const version = new SemVer('1.0.0')
      expect(version.inc('prepatch', 'beta').toString()).toBe('1.0.1-beta.0')
      expect(version.inc('preminor', 'alpha').toString()).toBe('1.1.0-alpha.0')
      expect(version.inc('premajor', 'rc').toString()).toBe('2.0.0-rc.0')
    })

    it('should increment existing prerelease versions', () => {
      const version = new SemVer('1.0.0-beta.1')
      expect(version.inc('prerelease').toString()).toBe('1.0.0-beta.2')
    })
  })

  describe('Configuration', () => {
    it('should have sensible defaults', () => {
      expect(bumpConfigDefaults.commit).toBe(true)
      expect(bumpConfigDefaults.tag).toBe(true)
      expect(bumpConfigDefaults.push).toBe(true)
      expect(bumpConfigDefaults.confirm).toBe(true)
      expect(bumpConfigDefaults.quiet).toBe(false)
      expect(bumpConfigDefaults.ci).toBe(false)
    })
  })

  describe('Utility functions', () => {
    it('should increment versions correctly', () => {
      expect(incrementVersion('1.0.0', 'patch')).toBe('1.0.1')
      expect(incrementVersion('1.0.0', 'minor')).toBe('1.1.0')
      expect(incrementVersion('1.0.0', 'major')).toBe('2.0.0')
    })

    it('should handle direct version strings', () => {
      // Test with real function behavior
      expect(isValidVersion('2.5.0')).toBe(true)
      expect(isReleaseType('2.5.0')).toBe(false)
    })
  })

  describe('File operations (isolated)', () => {
    it('should create and read package.json', async () => {
      const packagePath = join(tempDir, 'package.json')
      const packageData = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
      }

      writeFileSync(packagePath, JSON.stringify(packageData, null, 2))
      expect(existsSync(packagePath)).toBe(true)

      const content = readFileSync(packagePath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.version).toBe('1.0.0')
      expect(parsed.name).toBe('test-package')
    })
  })

  describe('Version bump integration (no git)', () => {
    it('should bump version in package.json without git operations', async () => {
      // Create a test package.json
      const packagePath = join(tempDir, 'package.json')
      const initialPackage = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
      }
      writeFileSync(packagePath, JSON.stringify(initialPackage, null, 2))

      // Track progress events
      const progressEvents: any[] = []
      const progressCallback = (progress: any) => {
        progressEvents.push(progress)
      }

      // Bump version without git operations
      await versionBump({
        release: 'patch',
        files: [packagePath], // Specify the exact file to avoid conflicts
        commit: false,
        tag: false,
        push: false,
        confirm: false,
        quiet: true,
        noGitCheck: true,
        progress: progressCallback,
      })

      // Verify the file was updated
      const updatedContent = readFileSync(packagePath, 'utf-8')
      const updatedPackage = JSON.parse(updatedContent)
      expect(updatedPackage.version).toBe('1.0.1')
      expect(updatedPackage.name).toBe('test-package')

      // Verify progress was reported
      expect(progressEvents.length).toBeGreaterThan(0)
      const fileUpdatedEvents = progressEvents.filter(e => e.event === 'fileUpdated')
      expect(fileUpdatedEvents.length).toBe(1)
      expect(fileUpdatedEvents[0].newVersion).toBe('1.0.1')
    })

    it('should bump minor version correctly', async () => {
      const packagePath = join(tempDir, 'package.json')
      const initialPackage = {
        name: 'test-package',
        version: '1.5.10',
      }
      writeFileSync(packagePath, JSON.stringify(initialPackage, null, 2))

      await versionBump({
        release: 'minor',
        files: [packagePath], // Specify the exact file to avoid conflicts
        commit: false,
        tag: false,
        push: false,
        confirm: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(packagePath, 'utf-8')
      const updatedPackage = JSON.parse(updatedContent)
      expect(updatedPackage.version).toBe('1.6.0')
    })

    it('should bump major version correctly', async () => {
      const packagePath = join(tempDir, 'package.json')
      const initialPackage = {
        name: 'test-package',
        version: '2.3.4',
      }
      writeFileSync(packagePath, JSON.stringify(initialPackage, null, 2))

      await versionBump({
        release: 'major',
        files: [packagePath], // Specify the exact file to avoid conflicts
        commit: false,
        tag: false,
        push: false,
        confirm: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(packagePath, 'utf-8')
      const updatedPackage = JSON.parse(updatedContent)
      expect(updatedPackage.version).toBe('3.0.0')
    })

    it('should handle specific version strings', async () => {
      const packagePath = join(tempDir, 'package.json')
      const initialPackage = {
        name: 'test-package',
        version: '1.0.0',
      }
      writeFileSync(packagePath, JSON.stringify(initialPackage, null, 2))

      await versionBump({
        release: '3.2.1',
        files: [packagePath], // Specify the exact file to avoid conflicts
        commit: false,
        tag: false,
        push: false,
        confirm: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(packagePath, 'utf-8')
      const updatedPackage = JSON.parse(updatedContent)
      expect(updatedPackage.version).toBe('3.2.1')
    })

    it('should work with multiple files', async () => {
      // Create package.json
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'root', version: '1.0.0' }, null, 2))

      // Create subdirectory with another package.json
      const subDir = join(tempDir, 'packages', 'sub')
      mkdirSync(subDir, { recursive: true })
      const subPackagePath = join(subDir, 'package.json')
      writeFileSync(subPackagePath, JSON.stringify({ name: 'sub', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        confirm: false,
        quiet: true,
        noGitCheck: true,
      })

      // Check both files were updated
      const rootPackage = JSON.parse(readFileSync(packagePath, 'utf-8'))
      const subPackage = JSON.parse(readFileSync(subPackagePath, 'utf-8'))

      expect(rootPackage.version).toBe('1.0.1')
      expect(subPackage.version).toBe('1.0.1')
    })
  })

  describe('Error handling', () => {
    it('should handle missing package.json gracefully', async () => {
      await expect(versionBump({
        release: 'patch',
        commit: false,
        tag: false,
        push: false,
        confirm: false,
        quiet: true,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle invalid version strings', () => {
      expect(() => new SemVer('invalid')).toThrow()
      expect(() => new SemVer('1.2')).toThrow()
      expect(() => new SemVer('1.2.3.4')).toThrow()
    })
  })

  describe('CI mode', () => {
    it('should work in CI mode', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath], // Specify the exact file to avoid conflicts
        ci: true,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedPackage = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedPackage.version).toBe('1.0.1')
    })
  })
})
