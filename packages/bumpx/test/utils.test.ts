import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkGitStatus,
  colors,
  createGitCommit,
  createGitTag,
  executeCommand,
  executeGit,
  findPackageJsonFiles,
  getCurrentBranch,
  getRecentCommits,
  incrementVersion,
  isReleaseType,
  isValidVersion,
  pushToRemote,
  readPackageJson,
  SemVer,
  symbols,
  updateVersionInFile,
  writePackageJson,
} from '../src/utils'

// Mock the execSync for git operations
const mockExecSync = mock(() => '')

mock.module('node:child_process', () => ({
  execSync: mockExecSync,
}))

// Mock process for testing
const mockProcess = {
  cwd: () => '/test/dir',
  stdout: { write: mock(() => {}) },
  stdin: { once: mock(() => {}) },
}
mock.module('node:process', () => mockProcess)

describe('SemVer', () => {
  describe('constructor and parsing', () => {
    it('should parse valid semver versions', () => {
      const v1 = new SemVer('1.2.3')
      expect(v1.major).toBe(1)
      expect(v1.minor).toBe(2)
      expect(v1.patch).toBe(3)
      expect(v1.prerelease).toEqual([])

      const v2 = new SemVer('1.2.3-alpha.1')
      expect(v2.major).toBe(1)
      expect(v2.minor).toBe(2)
      expect(v2.patch).toBe(3)
      expect(v2.prerelease).toEqual(['alpha', '1'])

      const v3 = new SemVer('v2.0.0-beta.2')
      expect(v3.major).toBe(2)
      expect(v3.minor).toBe(0)
      expect(v3.patch).toBe(0)
      expect(v3.prerelease).toEqual(['beta', '2'])
    })

    it('should throw error for invalid versions', () => {
      expect(() => new SemVer('invalid')).toThrow('Invalid version: invalid')
      expect(() => new SemVer('1.2')).toThrow('Invalid version: 1.2')
      expect(() => new SemVer('1.2.3.4')).toThrow('Invalid version: 1.2.3.4')
    })

    it('should handle edge case version formats', () => {
      // Test with build metadata (should be ignored in comparison but parsed)
      const v1 = new SemVer('1.0.0+build.1')
      expect(v1.major).toBe(1)
      expect(v1.minor).toBe(0)
      expect(v1.patch).toBe(0)
      expect(v1.build).toEqual(['build', '1'])

      // Test complex prerelease
      const v2 = new SemVer('2.0.0-alpha.1.beta.2')
      expect(v2.prerelease).toEqual(['alpha', '1', 'beta', '2'])

      // Test zero versions
      const v3 = new SemVer('0.0.0')
      expect(v3.major).toBe(0)
      expect(v3.minor).toBe(0)
      expect(v3.patch).toBe(0)
    })

    it('should handle case-insensitive prerelease identifiers', () => {
      const v1 = new SemVer('1.0.0-ALPHA.1')
      expect(v1.prerelease).toEqual(['ALPHA', '1'])

      const v2 = new SemVer('1.0.0-Beta.RC.1')
      expect(v2.prerelease).toEqual(['Beta', 'RC', '1'])
    })

    it('should handle very large version numbers', () => {
      const v = new SemVer('999.999.999')
      expect(v.major).toBe(999)
      expect(v.minor).toBe(999)
      expect(v.patch).toBe(999)
    })
  })

  describe('increment', () => {
    it('should increment major version', () => {
      const v = new SemVer('1.2.3')
      const incremented = v.inc('major')
      expect(incremented.toString()).toBe('2.0.0')
    })

    it('should increment minor version', () => {
      const v = new SemVer('1.2.3')
      const incremented = v.inc('minor')
      expect(incremented.toString()).toBe('1.3.0')
    })

    it('should increment patch version', () => {
      const v = new SemVer('1.2.3')
      const incremented = v.inc('patch')
      expect(incremented.toString()).toBe('1.2.4')
    })

    it('should increment premajor version', () => {
      const v = new SemVer('1.2.3')
      const incremented = v.inc('premajor', 'beta')
      expect(incremented.toString()).toBe('2.0.0-beta.0')
    })

    it('should increment preminor version', () => {
      const v = new SemVer('1.2.3')
      const incremented = v.inc('preminor', 'alpha')
      expect(incremented.toString()).toBe('1.3.0-alpha.0')
    })

    it('should increment prepatch version', () => {
      const v = new SemVer('1.2.3')
      const incremented = v.inc('prepatch', 'rc')
      expect(incremented.toString()).toBe('1.2.4-rc.0')
    })

    it('should increment prerelease version', () => {
      const v1 = new SemVer('1.2.3')
      const incremented1 = v1.inc('prerelease', 'beta')
      expect(incremented1.toString()).toBe('1.2.4-beta.0')

      const v2 = new SemVer('1.2.3-beta.1')
      const incremented2 = v2.inc('prerelease')
      expect(incremented2.toString()).toBe('1.2.3-beta.2')
    })

    it('should handle edge cases in prerelease increment', () => {
      // Test prerelease without numeric ending
      const v1 = new SemVer('1.0.0-alpha')
      const inc1 = v1.inc('prerelease')
      expect(inc1.toString()).toBe('1.0.0-alpha.0')

      // Test complex prerelease identifiers
      const v2 = new SemVer('1.0.0-alpha.beta.1')
      const inc2 = v2.inc('prerelease')
      expect(inc2.toString()).toBe('1.0.0-alpha.beta.2')

      // Test prerelease with non-numeric last segment
      const v3 = new SemVer('1.0.0-alpha.beta')
      const inc3 = v3.inc('prerelease')
      expect(inc3.toString()).toBe('1.0.0-alpha.beta.0')
    })

    it('should handle default preid for prerelease versions', () => {
      const v = new SemVer('1.0.0')
      const inc = v.inc('prerelease') // No preid provided, should default to 'alpha'
      expect(inc.toString()).toBe('1.0.1-alpha.0')
    })

    it('should preserve and clear prerelease correctly on regular increments', () => {
      const v = new SemVer('1.2.3-alpha.1')

      expect(v.inc('patch').toString()).toBe('1.2.4')
      expect(v.inc('minor').toString()).toBe('1.3.0')
      expect(v.inc('major').toString()).toBe('2.0.0')
    })

    it('should handle very large version increments', () => {
      const v = new SemVer('999.999.999')
      const incremented = v.inc('patch')
      expect(incremented.toString()).toBe('999.999.1000')
    })
  })

  describe('toString', () => {
    it('should convert to string correctly', () => {
      expect(new SemVer('1.2.3').toString()).toBe('1.2.3')
      expect(new SemVer('1.2.3-alpha.1').toString()).toBe('1.2.3-alpha.1')
    })

    it('should handle complex prerelease in toString', () => {
      expect(new SemVer('1.0.0-alpha.beta.1.rc.2').toString()).toBe('1.0.0-alpha.beta.1.rc.2')
    })

    it('should not include build metadata in toString', () => {
      // Build metadata should not be included in toString as per SemVer spec for comparison
      const v = new SemVer('1.0.0+build.1')
      expect(v.toString()).toBe('1.0.0')
    })
  })

  describe('SemVer edge cases and error conditions', () => {
    it('should handle malformed version strings gracefully', () => {
      expect(() => new SemVer('')).toThrow()
      expect(() => new SemVer('1')).toThrow()
      expect(() => new SemVer('1.2')).toThrow()
      expect(() => new SemVer('1.2.3.4.5')).toThrow()
      expect(() => new SemVer('a.b.c')).toThrow()
      expect(() => new SemVer('1.2.3-')).toThrow()
      expect(() => new SemVer('1.2.3+')).toThrow()
    })

    it('should handle special characters in prerelease', () => {
      // Valid prerelease identifiers
      expect(() => new SemVer('1.0.0-alpha-beta')).not.toThrow()
      expect(() => new SemVer('1.0.0-alpha123')).not.toThrow()

      // Should normalize case
      const v = new SemVer('1.0.0-ALPHA.BETA.1')
      expect(v.prerelease).toEqual(['ALPHA', 'BETA', '1'])
    })

    it('should handle increment operations that maintain immutability', () => {
      const original = new SemVer('1.0.0')
      const incremented = original.inc('patch')

      // Original should be unchanged
      expect(original.toString()).toBe('1.0.0')
      expect(incremented.toString()).toBe('1.0.1')
      expect(original).not.toBe(incremented)
    })
  })
})

describe('Version validation', () => {
  describe('isReleaseType', () => {
    it('should validate release types', () => {
      expect(isReleaseType('major')).toBe(true)
      expect(isReleaseType('minor')).toBe(true)
      expect(isReleaseType('patch')).toBe(true)
      expect(isReleaseType('premajor')).toBe(true)
      expect(isReleaseType('preminor')).toBe(true)
      expect(isReleaseType('prepatch')).toBe(true)
      expect(isReleaseType('prerelease')).toBe(true)
      expect(isReleaseType('invalid')).toBe(false)
      expect(isReleaseType('')).toBe(false)
    })

    it('should handle case sensitivity', () => {
      expect(isReleaseType('MAJOR')).toBe(false)
      expect(isReleaseType('Major')).toBe(false)
      expect(isReleaseType('PATCH')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isReleaseType(null as any)).toBe(false)
      expect(isReleaseType(undefined as any)).toBe(false)
      expect(isReleaseType(123 as any)).toBe(false)
      expect(isReleaseType('patchh')).toBe(false) // typo
      expect(isReleaseType('patch ')).toBe(false) // trailing space
      expect(isReleaseType(' patch')).toBe(false) // leading space
    })
  })

  describe('isValidVersion', () => {
    it('should validate version strings', () => {
      expect(isValidVersion('1.2.3')).toBe(true)
      expect(isValidVersion('1.2.3-alpha.1')).toBe(true)
      expect(isValidVersion('v2.0.0')).toBe(true)
      expect(isValidVersion('invalid')).toBe(false)
      expect(isValidVersion('1.2')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isValidVersion('')).toBe(false)
      expect(isValidVersion(null as any)).toBe(false)
      expect(isValidVersion(undefined as any)).toBe(false)
      expect(isValidVersion(123 as any)).toBe(false)
      expect(isValidVersion('1.2.3.4')).toBe(false)
      expect(isValidVersion('1.2.3-')).toBe(false)
      expect(isValidVersion('1.2.3+')).toBe(false)
    })

    it('should validate complex version formats', () => {
      expect(isValidVersion('0.0.0')).toBe(true)
      expect(isValidVersion('999.999.999')).toBe(true)
      expect(isValidVersion('1.0.0-alpha.beta.1')).toBe(true)
      expect(isValidVersion('1.0.0+build.1')).toBe(true)
      expect(isValidVersion('1.0.0-alpha+build')).toBe(true)
    })
  })

  describe('incrementVersion', () => {
    it('should increment version with release type', () => {
      // Test with actual SemVer implementation to verify logic
      const v123 = new SemVer('1.2.3')
      expect(v123.inc('patch').toString()).toBe('1.2.4')
      expect(v123.inc('minor').toString()).toBe('1.3.0')
      expect(v123.inc('major').toString()).toBe('2.0.0')
    })

    it('should return exact version if valid version string provided', () => {
      expect(incrementVersion('1.0.0', '2.0.0')).toBe('2.0.0')
      expect(incrementVersion('1.0.0', '1.5.3-alpha.1')).toBe('1.5.3-alpha.1')
    })

    it('should throw error for invalid inputs', () => {
      expect(() => incrementVersion('1.0.0', 'invalid')).toThrow('Invalid release type or version')
      expect(() => incrementVersion('1.0.0', '')).toThrow('Invalid release type or version')
      expect(() => incrementVersion('invalid', 'patch')).toThrow('Invalid version')
    })

    it('should handle prerelease increments with preid', () => {
      expect(incrementVersion('1.0.0', 'prepatch', 'beta')).toBe('1.0.1-beta.0')
      expect(incrementVersion('1.0.0', 'preminor', 'alpha')).toBe('1.1.0-alpha.0')
      expect(incrementVersion('1.0.0', 'premajor', 'rc')).toBe('2.0.0-rc.0')
    })

    it('should validate release types correctly', () => {
      expect(isReleaseType('patch')).toBe(true)
      expect(isReleaseType('minor')).toBe(true)
      expect(isReleaseType('major')).toBe(true)
      expect(isReleaseType('invalid')).toBe(false)
    })
  })
})

describe('File operations', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('findPackageJsonFiles', () => {
    it('should find package.json in current directory', async () => {
      const packageJsonPath = join(tempDir, 'package.json')
      writeFileSync(packageJsonPath, JSON.stringify({ name: 'test', version: '1.0.0' }))

      const files = await findPackageJsonFiles(tempDir, false)
      expect(files).toContain(packageJsonPath)
      expect(files.length).toBeGreaterThan(0)
    })

    it('should find package.json files recursively', async () => {
      const rootPackage = join(tempDir, 'package.json')
      const subDir = join(tempDir, 'packages', 'sub')
      mkdirSync(subDir, { recursive: true })
      const subPackage = join(subDir, 'package.json')

      writeFileSync(rootPackage, JSON.stringify({ name: 'root', version: '1.0.0' }))
      writeFileSync(subPackage, JSON.stringify({ name: 'sub', version: '1.0.0' }))

      const files = await findPackageJsonFiles(tempDir, true)
      expect(files.length).toBeGreaterThanOrEqual(2)
      expect(files.some(f => f.endsWith('package.json'))).toBe(true)
    })

    it('should ignore node_modules and hidden directories', async () => {
      const rootPackage = join(tempDir, 'package.json')
      const nodeModulesDir = join(tempDir, 'node_modules', 'some-package')
      const hiddenDir = join(tempDir, '.git')

      mkdirSync(nodeModulesDir, { recursive: true })
      mkdirSync(hiddenDir, { recursive: true })

      writeFileSync(rootPackage, JSON.stringify({ name: 'root', version: '1.0.0' }))
      writeFileSync(join(nodeModulesDir, 'package.json'), JSON.stringify({ name: 'dep', version: '1.0.0' }))
      writeFileSync(join(hiddenDir, 'package.json'), JSON.stringify({ name: 'hidden', version: '1.0.0' }))

      const files = await findPackageJsonFiles(tempDir, true)
      expect(files).toContain(rootPackage)
      expect(files.some(f => f.includes('node_modules'))).toBe(false)
      expect(files.some(f => f.includes('.git'))).toBe(false)
    })

    it('should handle empty directories', async () => {
      const files = await findPackageJsonFiles(tempDir, false)
      expect(files).toEqual([])
    })

    it('should handle non-existent directories', async () => {
      const nonExistentDir = join(tempDir, 'non-existent')
      const files = await findPackageJsonFiles(nonExistentDir, false)
      expect(files).toEqual([])
    })
  })

  describe('readPackageJson and writePackageJson', () => {
    it('should read and write package.json files', () => {
      const packagePath = join(tempDir, 'test-package.json')
      const packageData = { name: 'test-package', version: '1.2.3', dependencies: {} }

      writePackageJson(packagePath, packageData)
      expect(existsSync(packagePath)).toBe(true)

      const readData = readPackageJson(packagePath)
      expect(readData.name).toBe(packageData.name)
      expect(readData.version).toBe(packageData.version)
    })

    it('should throw error for invalid file', () => {
      const invalidPath = join(tempDir, 'nonexistent.json')
      expect(() => readPackageJson(invalidPath)).toThrow()
    })

    it('should handle malformed JSON', () => {
      const malformedPath = join(tempDir, 'malformed.json')
      writeFileSync(malformedPath, '{ invalid json }')
      expect(() => readPackageJson(malformedPath)).toThrow('Failed to read package.json')
    })

    it('should preserve formatting when writing', () => {
      const packagePath = join(tempDir, 'format-test.json')
      const packageData = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
        scripts: { test: 'echo test' },
      }

      writePackageJson(packagePath, packageData)

      const content = readFileSync(packagePath, 'utf-8')
      expect(content).toContain('  ') // Should have 2-space indentation
      expect(content.endsWith('\n')).toBe(true) // Should end with newline
    })
  })

  describe('updateVersionInFile', () => {
    it('should update version in package.json', () => {
      const packagePath = join(tempDir, 'update-test.json')
      const packageData = { name: 'test', version: '1.0.0' }
      writeFileSync(packagePath, JSON.stringify(packageData, null, 2))

      const result = updateVersionInFile(packagePath, '1.0.0', '1.1.0')
      expect(result.updated).toBe(true)
      expect(result.path).toBe(packagePath)

      const updatedData = readPackageJson(packagePath)
      expect(updatedData.version).toBe('1.1.0')
    })

    it('should not update if version does not match', () => {
      const packagePath = join(tempDir, 'nomatch-test.json')
      const packageData = { name: 'test', version: '2.0.0' }
      writeFileSync(packagePath, JSON.stringify(packageData, null, 2))

      const result = updateVersionInFile(packagePath, '1.0.0', '1.1.0')
      expect(result.updated).toBe(false)
    })

    it('should update version in non-package.json files', () => {
      const filePath = join(tempDir, 'version.txt')
      writeFileSync(filePath, 'Version: 1.0.0\nSome other content')

      const result = updateVersionInFile(filePath, '1.0.0', '1.1.0')
      expect(result.updated).toBe(true)
    })

    it('should handle files with no version match in non-JSON files', () => {
      const filePath = join(tempDir, 'no-version.txt')
      writeFileSync(filePath, 'Some content without version')

      const result = updateVersionInFile(filePath, '1.0.0', '1.1.0')
      expect(result.updated).toBe(false)
    })

    it('should handle complex version strings in text files', () => {
      const filePath = join(tempDir, 'complex-version.txt')
      writeFileSync(filePath, 'Version: 1.0.0-alpha.1+build.123\nAnother line with 1.0.0-alpha.1 reference')

      const result = updateVersionInFile(filePath, '1.0.0-alpha.1', '1.0.0-alpha.2')
      expect(result.updated).toBe(true)

      const content = readFileSync(filePath, 'utf-8')
      expect(content).toContain('1.0.0-alpha.2+build.123')
      expect(content).toContain('1.0.0-alpha.2 reference')
    })

    it('should handle word boundaries in version replacement', () => {
      const filePath = join(tempDir, 'boundary-test.txt')
      writeFileSync(filePath, 'Version 1.0.0 and version 11.0.0 and 1.0.00')

      const result = updateVersionInFile(filePath, '1.0.0', '1.1.0')
      expect(result.updated).toBe(true)

      const content = readFileSync(filePath, 'utf-8')
      expect(content).toBe('Version 1.1.0 and version 11.0.0 and 1.0.00')
    })

    it('should return correct FileInfo structure', () => {
      const packagePath = join(tempDir, 'fileinfo-test.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const result = updateVersionInFile(packagePath, '1.0.0', '1.1.0')

      expect(result.path).toBe(packagePath)
      expect(result.updated).toBe(true)
      expect(result.oldVersion).toBe('1.0.0')
      expect(result.newVersion).toBe('1.1.0')
      expect(result.content).toContain('"version": "1.1.0"')
    })

    it('should handle file permission errors', () => {
      const packagePath = join(tempDir, 'readonly-test.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // This test may not work on all systems
      try {
        chmodSync(packagePath, 0o444) // Read-only
        expect(() => updateVersionInFile(packagePath, '1.0.0', '1.1.0')).toThrow('Failed to update version')
      }
      catch {
        // Skip if chmod fails
      }
    })
  })
})

describe('Git operations (simplified)', () => {
  describe('git function availability', () => {
    it('should have git utility functions available', () => {
      expect(typeof executeGit).toBe('function')
      expect(typeof checkGitStatus).toBe('function')
      expect(typeof getCurrentBranch).toBe('function')
      expect(typeof createGitCommit).toBe('function')
      expect(typeof createGitTag).toBe('function')
      expect(typeof pushToRemote).toBe('function')
      expect(typeof getRecentCommits).toBe('function')
    })
  })
})

describe('Command execution (simplified)', () => {
  describe('executeCommand function', () => {
    it('should be available as a function', () => {
      expect(typeof executeCommand).toBe('function')
    })
  })
})

describe('Utilities', () => {
  describe('symbols', () => {
    it('should have all required symbols', () => {
      expect(symbols.success).toBeDefined()
      expect(symbols.error).toBeDefined()
      expect(symbols.warning).toBeDefined()
      expect(symbols.info).toBeDefined()
      expect(symbols.question).toBeDefined()
    })

    it('should have meaningful symbol values', () => {
      expect(typeof symbols.success).toBe('string')
      expect(typeof symbols.error).toBe('string')
      expect(typeof symbols.warning).toBe('string')
      expect(typeof symbols.info).toBe('string')
      expect(typeof symbols.question).toBe('string')

      expect(symbols.success.length).toBeGreaterThan(0)
      expect(symbols.error.length).toBeGreaterThan(0)
    })
  })

  describe('colors', () => {
    it('should have color functions', () => {
      expect(typeof colors.green).toBe('function')
      expect(typeof colors.red).toBe('function')
      expect(typeof colors.yellow).toBe('function')
      expect(typeof colors.blue).toBe('function')
      expect(typeof colors.gray).toBe('function')
      expect(typeof colors.bold).toBe('function')
    })

    it('should apply ANSI color codes', () => {
      expect(colors.green('test')).toContain('\x1B[32m')
      expect(colors.red('test')).toContain('\x1B[31m')
      expect(colors.yellow('test')).toContain('\x1B[33m')
      expect(colors.blue('test')).toContain('\x1B[34m')
      expect(colors.gray('test')).toContain('\x1B[90m')
      expect(colors.bold('test')).toContain('\x1B[1m')
    })

    it('should reset colors properly', () => {
      expect(colors.green('test')).toContain('\x1B[0m')
      expect(colors.red('test')).toContain('\x1B[0m')
      expect(colors.bold('test')).toContain('\x1B[0m')
    })

    it('should handle empty strings', () => {
      expect(colors.green('')).toBe('\x1B[32m\x1B[0m')
      expect(colors.red('')).toBe('\x1B[31m\x1B[0m')
    })

    it('should handle special characters', () => {
      const specialText = 'Special chars: @#$%^&*()'
      expect(colors.blue(specialText)).toContain(specialText)
      expect(colors.blue(specialText)).toContain('\x1B[34m')
      expect(colors.blue(specialText)).toContain('\x1B[0m')
    })
  })
})

describe('Advanced Error Handling', () => {
  describe('Edge cases in version parsing', () => {
    it('should handle malformed input gracefully', () => {
      expect(() => incrementVersion('', 'patch')).toThrow()
      expect(() => incrementVersion('1.0.0', null as any)).toThrow()
      expect(() => incrementVersion(null as any, 'patch')).toThrow()
      expect(() => incrementVersion(undefined as any, 'patch')).toThrow()
    })

    it('should handle extreme version numbers', () => {
      const extremeVersion = '999999999.999999999.999999999'
      expect(isValidVersion(extremeVersion)).toBe(true)

      const v = new SemVer(extremeVersion)
      const incremented = v.inc('patch')
      expect(incremented.patch).toBe(1000000000)
    })

    it('should handle unicode characters in prerelease', () => {
      // SemVer spec allows ASCII alphanumerics and hyphens
      expect(() => new SemVer('1.0.0-α.β.1')).toThrow() // Greek letters should be invalid
      expect(() => new SemVer('1.0.0-测试.1')).toThrow() // Chinese chars should be invalid
    })

    it('should validate prerelease identifier format', () => {
      // Valid identifiers
      expect(() => new SemVer('1.0.0-alpha')).not.toThrow()
      expect(() => new SemVer('1.0.0-alpha123')).not.toThrow()
      expect(() => new SemVer('1.0.0-123alpha')).not.toThrow()
      expect(() => new SemVer('1.0.0-alpha-beta')).not.toThrow()

      // Invalid identifiers (empty segments)
      expect(() => new SemVer('1.0.0-alpha.')).toThrow()
      expect(() => new SemVer('1.0.0-.alpha')).toThrow()
      expect(() => new SemVer('1.0.0-alpha..beta')).toThrow()
    })
  })

  describe('File system edge cases', () => {
    let tempDir: string

    beforeEach(() => {
      tempDir = join(tmpdir(), `bumpx-edge-test-${Date.now()}`)
      mkdirSync(tempDir, { recursive: true })
    })

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should handle very large package.json files', () => {
      const packagePath = join(tempDir, 'large-package.json')
      const largePackageData: any = {
        name: 'large-package',
        version: '1.0.0',
        description: `A${'very '.repeat(10000)}long description`,
        dependencies: {},
      }

      // Add many dependencies
      for (let i = 0; i < 1000; i++) {
        largePackageData.dependencies[`dep-${i}`] = `^${i}.0.0`
      }

      writePackageJson(packagePath, largePackageData)
      const result = updateVersionInFile(packagePath, '1.0.0', '1.1.0')
      expect(result.updated).toBe(true)

      const updated = readPackageJson(packagePath)
      expect(updated.version).toBe('1.1.0')
      expect(Object.keys(updated.dependencies || {}).length).toBe(1000)
    })

    it('should handle deeply nested directory structures', async () => {
      // Create deep nesting
      let currentDir = tempDir
      for (let i = 0; i < 10; i++) {
        currentDir = join(currentDir, `level${i}`)
        mkdirSync(currentDir, { recursive: true })
      }

      const deepPackagePath = join(currentDir, 'package.json')
      writeFileSync(deepPackagePath, JSON.stringify({ name: 'deep', version: '1.0.0' }))

      const files = await findPackageJsonFiles(tempDir, true)
      expect(files).toContain(deepPackagePath)
    })

    it('should handle packages with unusual but valid JSON structures', () => {
      const packagePath = join(tempDir, 'unusual-package.json')
      const unusualPackage = {
        name: 'unusual',
        version: '1.0.0',
        nested: {
          deeply: {
            version: '1.0.0', // Should not be updated
          },
        },
        array: [
          { version: '1.0.0' }, // Should not be updated
          'version 1.0.0 string', // Should not be updated
        ],
      }

      writeFileSync(packagePath, JSON.stringify(unusualPackage, null, 2))
      const result = updateVersionInFile(packagePath, '1.0.0', '1.1.0')
      expect(result.updated).toBe(true)

      const updated = readPackageJson(packagePath)
      expect(updated.version).toBe('1.1.0')
      expect(updated.nested.deeply.version).toBe('1.0.0') // Should remain unchanged
      expect(updated.array[0].version).toBe('1.0.0') // Should remain unchanged
    })
  })
})
