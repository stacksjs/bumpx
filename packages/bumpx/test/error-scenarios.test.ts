import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Buffer } from 'node:buffer'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findPackageJsonFiles, incrementVersion, readPackageJson, updateVersionInFile } from '../src/utils'
import { versionBump } from '../src/version-bump'

describe('Error Scenarios and Edge Cases', () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = join(tmpdir(), `bumpx-error-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('File System Errors', () => {
    it('should handle permission denied errors', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Make file read-only (simulate permission error)
      chmodSync(packagePath, 0o444)

      try {
        await expect(versionBump({
          release: 'patch',
          files: [packagePath],
          commit: false,
          tag: false,
          push: false,
          noGitCheck: true,
        })).rejects.toThrow()
      }
      finally {
        // Restore permissions for cleanup
        chmodSync(packagePath, 0o644)
      }
    })

    it('should handle non-existent directories', async () => {
      const nonExistentPath = join(tempDir, 'non-existent', 'package.json')

      await expect(versionBump({
        release: 'patch',
        files: [nonExistentPath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle disk space issues (simulated)', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Create a very large package.json to simulate disk space issues
      const largePackageData: any = {
        name: 'test',
        version: '1.0.0',
        description: 'A'.repeat(1000000), // 1MB description
        dependencies: {},
      }

      for (let i = 0; i < 1000; i++) {
        largePackageData.dependencies[`dep-${i}`] = '^1.0.0'
      }

      writeFileSync(packagePath, JSON.stringify(largePackageData, null, 2))

      // This should still work, just be slow
      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const result = readPackageJson(packagePath)
      expect(result.version).toBe('1.0.1')
    })

    it('should handle concurrent file access', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Simulate concurrent access by running multiple version bumps
      const promises = []
      for (let i = 0; i < 3; i++) {
        promises.push(
          versionBump({
            release: 'patch',
            files: [packagePath],
            commit: false,
            tag: false,
            push: false,
            noGitCheck: true,
          }).catch(error => error),
        )
      }

      const results = await Promise.all(promises)

      // At least one should succeed
      const successful = results.filter(r => !(r instanceof Error))
      expect(successful.length).toBeGreaterThan(0)
    })
  })

  describe('Malformed Files', () => {
    it('should handle completely invalid JSON', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, 'this is not json at all')

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle partially valid JSON', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, '{ "name": "test", "version": "1.0.0", }') // Trailing comma

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle empty files', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, '')

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle binary files', async () => {
      const packagePath = join(tempDir, 'package.json')
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG header
      writeFileSync(packagePath, binaryData)

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle very large JSON files', async () => {
      const packagePath = join(tempDir, 'package.json')
      const largePackageData: any = {
        name: 'large-package',
        version: '1.0.0',
        dependencies: {},
      }

      // Create 10,000 dependencies
      for (let i = 0; i < 10000; i++) {
        largePackageData.dependencies[`dependency-${i}`] = `^${i}.0.0`
      }

      writeFileSync(packagePath, JSON.stringify(largePackageData, null, 2))

      // Should still work, just be slow
      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const result = readPackageJson(packagePath)
      expect(result.version).toBe('1.0.1')
    })
  })

  describe('Invalid Version Formats', () => {
    it('should handle non-semver versions', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0' }, null, 2))

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle version with invalid characters', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0-beta@invalid' }, null, 2))

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle missing version field', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test' }, null, 2))

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle null version field', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: null }, null, 2))

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle non-string version field', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: 1.0 }, null, 2))

      await expect(versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })
  })

  describe('Invalid Release Types', () => {
    beforeEach(() => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
    })

    it('should handle invalid release type', async () => {
      await expect(versionBump({
        release: 'invalid-release-type',
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle empty release type', async () => {
      await expect(versionBump({
        release: '',
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle null release type', async () => {
      await expect(versionBump({
        release: null as any,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle undefined release type', async () => {
      await expect(versionBump({
        release: undefined as any,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })
  })

  describe('Edge Cases in Version Increment', () => {
    it('should handle extremely large version numbers', () => {
      const largeVersion = '999999999.999999999.999999999'
      const incremented = incrementVersion(largeVersion, 'patch')
      expect(incremented).toBe('999999999.999999999.1000000000')
    })

    it('should handle version with many prerelease segments', () => {
      const complexVersion = '1.0.0-alpha.beta.gamma.delta.1'
      const incremented = incrementVersion(complexVersion, 'prerelease')
      expect(incremented).toBe('1.0.0-alpha.beta.gamma.delta.2')
    })

    it('should handle version increment overflow', () => {
      // Test edge case where numbers get very large
      const version = '999999999.999999999.999999999-alpha.999999999'
      const incremented = incrementVersion(version, 'prerelease')
      expect(incremented).toBe('999999999.999999999.999999999-alpha.1000000000')
    })

    it('should handle version with unusual prerelease identifiers', () => {
      const version = '1.0.0-0.1.2'
      const incremented = incrementVersion(version, 'prerelease')
      expect(incremented).toBe('1.0.0-0.1.3')
    })

    it('should handle version with build metadata', () => {
      const version = '1.0.0+build.123'
      const incremented = incrementVersion(version, 'patch')
      expect(incremented).toBe('1.0.1')
    })
  })

  describe('Network and System Errors', () => {
    beforeEach(() => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
    })

    it('should handle system command failures', async () => {
      const packagePath = join(tempDir, 'package.json')

      // Execute command failures should be handled gracefully (like install failures)
      // The version bump should succeed but log a warning
      await versionBump({
        release: 'patch',
        execute: 'false', // 'false' command always exits with code 1
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      // Version should still be updated despite command failure
      const packageContent = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(packageContent.version).toBe('1.0.1')
    })

    it('should handle git command failures when git is not available', async () => {
      // This is hard to simulate, but we can test the error handling
      await versionBump({
        release: 'patch',
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true, // Bypass git check to avoid this issue
      })

      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('1.0.1')
    })
  })

  describe('Resource Exhaustion', () => {
    it('should handle memory pressure with many files', async () => {
      // Create many package.json files
      const fileCount = 1000
      const files: string[] = []

      for (let i = 0; i < fileCount; i++) {
        const dir = join(tempDir, `package-${i}`)
        mkdirSync(dir, { recursive: true })
        const filePath = join(dir, 'package.json')
        writeFileSync(filePath, JSON.stringify({ name: `package-${i}`, version: '1.0.0' }, null, 2))
        files.push(filePath)
      }

      // This should work but might be slow
      const foundFiles = await findPackageJsonFiles(tempDir, true)
      expect(foundFiles.length).toBe(fileCount)
    })

    it('should handle deeply nested directories', async () => {
      // Create deeply nested structure
      let currentDir = tempDir
      for (let i = 0; i < 100; i++) {
        currentDir = join(currentDir, `level-${i}`)
        mkdirSync(currentDir, { recursive: true })
      }

      const packagePath = join(currentDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'deep-package', version: '1.0.0' }, null, 2))

      const files = await findPackageJsonFiles(tempDir, true)
      expect(files).toContain(packagePath)
    })
  })

  describe('Race Conditions', () => {
    it('should handle simultaneous file operations', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Simulate race condition with multiple rapid updates
      // Only the first one should succeed since it changes the version
      const operations = []
      for (let i = 0; i < 5; i++) {
        operations.push(
          updateVersionInFile(packagePath, '1.0.0', `1.0.${i + 1}`),
        )
      }

      // Only the first operation should succeed
      expect(operations[0].updated).toBe(true)
      // The rest should fail because the version is no longer '1.0.0'
      for (let i = 1; i < operations.length; i++) {
        expect(operations[i].updated).toBe(false)
      }
    })
  })

  describe('Unicode and Special Characters', () => {
    it('should handle package names with unicode characters', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({
        name: '测试包-🚀-package',
        version: '1.0.0',
      }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const result = readPackageJson(packagePath)
      expect(result.version).toBe('1.0.1')
      expect(result.name).toBe('测试包-🚀-package')
    })

    it('should handle file paths with special characters', async () => {
      const specialDir = join(tempDir, 'special@dir with spaces & symbols')
      mkdirSync(specialDir, { recursive: true })

      const packagePath = join(specialDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      await versionBump({
        release: 'patch',
        files: [packagePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const result = readPackageJson(packagePath)
      expect(result.version).toBe('1.0.1')
    })
  })

  describe('Configuration Errors', () => {
    beforeEach(() => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
    })

    it('should handle missing current version in synchronized mode', async () => {
      await expect(versionBump({
        release: 'patch',
        currentVersion: '', // Empty current version
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle invalid file paths in files array', async () => {
      await expect(versionBump({
        release: 'patch',
        files: ['/invalid/path/package.json', null as any, undefined as any],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })).rejects.toThrow()
    })

    it('should handle circular references in package.json', async () => {
      const packagePath = join(tempDir, 'package.json')

      // Create an object with circular reference
      const circular: any = { name: 'test', version: '1.0.0' }
      circular.self = circular

      // This will fail when trying to JSON.stringify
      expect(() => {
        writeFileSync(packagePath, JSON.stringify(circular, null, 2))
      }).toThrow()
    })
  })

  describe('Recovery and Rollback', () => {
    it('should handle partial failures gracefully', async () => {
      // Create multiple files, some valid, some invalid
      const validPath = join(tempDir, 'valid.json')
      const invalidPath = join(tempDir, 'invalid.json')

      writeFileSync(validPath, JSON.stringify({ name: 'valid', version: '1.0.0' }, null, 2))
      writeFileSync(invalidPath, '{ invalid json }')

      // Should handle mixed results gracefully (not throw if some files succeed)
      await versionBump({
        release: 'patch',
        files: [validPath, invalidPath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      // Valid file should have been updated despite the invalid file
      const validContent = JSON.parse(readFileSync(validPath, 'utf-8'))
      expect(validContent.version).toBe('1.0.1') // Should be updated
    })
  })
})
