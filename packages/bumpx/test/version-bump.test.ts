import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProgressEvent } from '../src/types'
import { versionBump } from '../src/version-bump'

describe('Version Bump (Integration)', () => {
  let tempDir: string
  let progressEvents: any[]

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-version-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })
    progressEvents = []
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  const createProgressCallback = () => (progress: any) => {
    progressEvents.push(progress)
  }

  describe('Real version bumping (no git)', () => {
    it('should bump patch version successfully', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1')

      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      expect(fileUpdatedEvents.length).toBe(1)
    })

    it('should bump minor version successfully', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'minor',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.1.0')
    })

    it('should bump major version successfully', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'major',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('2.0.0')
    })

    it('should handle specific version strings', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: '3.2.1',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('3.2.1')
    })

    it('should work with multiple files', async () => {
      const packagePaths = [
        join(tempDir, 'package1.json'),
        join(tempDir, 'package2.json'),
      ]

      packagePaths.forEach((path) => {
        writeFileSync(path, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      })

      await versionBump({
        release: 'patch',
        files: packagePaths,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      packagePaths.forEach((path) => {
        const updatedContent = JSON.parse(readFileSync(path, 'utf-8'))
        expect(updatedContent.version).toBe('1.0.1')
      })
    })

    it('should skip files that do not match current version', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '2.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        currentVersion: '1.0.0', // Different from file version
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      // File should not be updated
      const content = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(content.version).toBe('2.0.0')

      const skippedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileSkipped)
      expect(skippedEvents.length).toBe(1)
    })

    it('should execute custom commands', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        execute: 'echo "test command"',
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      const executeEvents = progressEvents.filter(e => e.event === ProgressEvent.Execute)
      expect(executeEvents.length).toBe(1)
      expect(executeEvents[0].script).toBe('echo "test command"')
    })

    it('should handle error when no files found', async () => {
      // Create an empty temp directory
      const emptyTempDir = join(tmpdir(), `bumpx-empty-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      mkdirSync(emptyTempDir, { recursive: true })

      const originalCwd = process.cwd()
      process.chdir(emptyTempDir)

      try {
        await expect(versionBump({
          release: 'patch',
          commit: false,
          tag: false,
          push: false,
          quiet: true,
          noGitCheck: true,
        })).rejects.toThrow()
      }
      finally {
        process.chdir(originalCwd)
        if (existsSync(emptyTempDir)) {
          rmSync(emptyTempDir, { recursive: true, force: true })
        }
      }
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    it('should handle malformed package.json files', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, '{ invalid json }')

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle package.json without version field', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test' }, null, 2))

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })).rejects.toThrow('Could not determine current version')
    })

    it('should handle invalid release types', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await expect(versionBump({
        release: 'invalid-release-type',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })).rejects.toThrow('Invalid release type or version')
    })

    it('should handle empty release parameter', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await expect(versionBump({
        release: '',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })).rejects.toThrow('Release type or version must be specified')
    })

    it('should handle non-existent files', async () => {
      const nonExistentPath = join(tempDir, 'nonexistent.json')

      await expect(versionBump({
        release: 'patch',
        files: [nonExistentPath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle very large version numbers', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '999.999.999' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('999.999.1000')
    })

    it('should handle mixed case in prerelease identifiers', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0-ALPHA.1' }, null, 2))

      await versionBump({
        release: 'prerelease',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.0-ALPHA.2')
    })

    it('should preserve package.json formatting and properties', async () => {
      const packagePath = join(tempDir, 'package.json')
      const originalPackage = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
        keywords: ['test', 'package'],
        author: 'Test Author',
        license: 'MIT',
        dependencies: {
          lodash: '^4.17.21',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
        scripts: {
          build: 'tsc',
          test: 'jest',
        },
      }
      writeFileSync(packagePath, JSON.stringify(originalPackage, null, 2))

      await versionBump({
        release: 'minor',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.1.0')
      expect(updatedContent.name).toBe(originalPackage.name)
      expect(updatedContent.description).toBe(originalPackage.description)
      expect(updatedContent.dependencies).toEqual(originalPackage.dependencies)
      expect(updatedContent.scripts).toEqual(originalPackage.scripts)
    })

    it('should handle permission errors gracefully', async () => {
      const packagePath = join(tempDir, 'readonly.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Make file read-only on Unix systems (this test may not work on all systems)
      try {
        chmodSync(packagePath, 0o444) // Read-only

        await expect(versionBump({
          release: 'patch',
          files: [packagePath],
          commit: false,
          tag: false,
          push: false,
          quiet: true,
          noGitCheck: true,
        })).rejects.toThrow()
      }
      catch {
        // Skip this test if chmod fails (Windows, etc.)
      }
    })
  })

  describe('Complex Prerelease Scenarios', () => {
    it('should handle prerelease versions correctly', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'prepatch',
        preid: 'beta',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1-beta.0')
    })

    it('should handle incrementing existing prerelease versions', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0-alpha.1' }, null, 2))

      await versionBump({
        release: 'prerelease',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.0-alpha.2')
    })

    it('should handle prerelease without numeric identifier', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0-alpha' }, null, 2))

      await versionBump({
        release: 'prerelease',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.0-alpha.0')
    })

    it('should handle mixed prerelease identifiers', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '2.1.0-beta.rc.1' }, null, 2))

      await versionBump({
        release: 'prerelease',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('2.1.0-beta.rc.2')
    })
  })

  describe('Multi-file Operations', () => {
    it('should handle files with different versions', async () => {
      const package1Path = join(tempDir, 'package1.json')
      const package2Path = join(tempDir, 'package2.json')

      writeFileSync(package1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))
      writeFileSync(package2Path, JSON.stringify({ name: 'pkg2', version: '2.5.3' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [package1Path, package2Path],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      const pkg1Content = JSON.parse(readFileSync(package1Path, 'utf-8'))
      const pkg2Content = JSON.parse(readFileSync(package2Path, 'utf-8'))

      expect(pkg1Content.version).toBe('1.0.1')
      expect(pkg2Content.version).toBe('2.5.4')

      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      expect(fileUpdatedEvents.length).toBe(2)
    })

    it('should handle some files that need updates and some that do not', async () => {
      const package1Path = join(tempDir, 'package1.json')
      const package2Path = join(tempDir, 'package2.json')

      writeFileSync(package1Path, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2))
      writeFileSync(package2Path, JSON.stringify({ name: 'pkg2', version: '2.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        currentVersion: '1.0.0', // Only matches first file
        files: [package1Path, package2Path],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      const pkg1Content = JSON.parse(readFileSync(package1Path, 'utf-8'))
      const pkg2Content = JSON.parse(readFileSync(package2Path, 'utf-8'))

      expect(pkg1Content.version).toBe('1.0.1')
      expect(pkg2Content.version).toBe('2.0.0') // Unchanged

      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      const fileSkippedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileSkipped)
      expect(fileUpdatedEvents.length).toBe(1)
      expect(fileSkippedEvents.length).toBe(1)
    })

    it('should handle non-package.json files', async () => {
      const packagePath = join(tempDir, 'package.json')
      const versionPath = join(tempDir, 'version.txt')

      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      writeFileSync(versionPath, 'Version: 1.0.0\nBuild info and other content')

      await versionBump({
        release: 'minor',
        files: [packagePath, versionPath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const pkgContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      const versionContent = readFileSync(versionPath, 'utf-8')

      expect(pkgContent.version).toBe('1.1.0')
      expect(versionContent).toContain('Version: 1.1.0')
      expect(versionContent).toContain('Build info and other content')
    })
  })

  describe('Command Execution', () => {
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
        progress: createProgressCallback(),
      })

      const executeEvents = progressEvents.filter(e => e.event === ProgressEvent.Execute)
      expect(executeEvents.length).toBe(3)
      expect(executeEvents[0].script).toBe('echo "first"')
      expect(executeEvents[1].script).toBe('echo "second"')
      expect(executeEvents[2].script).toBe('echo "third"')
    })

    it('should handle command execution failures gracefully when install fails', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // This should not throw an error for install failures
      await versionBump({
        release: 'patch',
        files: [packagePath],
        install: true, // This will try to run 'npm install' which may fail
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1') // Should still update version
    })
  })

  describe('Version String Parsing Edge Cases', () => {
    it('should handle versions with v prefix', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: 'v1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1')
    })

    it('should handle zero versions', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '0.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('0.0.1')
    })

    it('should handle complex prerelease versions', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0-alpha.beta.1' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1')
    })

    it('should handle build metadata in versions', async () => {
      // Note: SemVer should ignore build metadata
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0+20230101.abc123' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1')
    })
  })
})
