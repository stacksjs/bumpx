import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { versionBump } from '../src/version-bump'

describe('File Types Support', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-file-types-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('pantry.json support', () => {
    it('should bump version in pantry.json', async () => {
      const pantryJsonPath = join(tempDir, 'pantry.json')
      writeFileSync(pantryJsonPath, JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        description: 'Test pantry package',
      }, null, 2))

      await versionBump({
        release: 'patch',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(pantryJsonPath, 'utf-8'))
      expect(updatedContent.version).toBe('1.0.1')
    })

    it('should bump version in pantry.json with all release types', async () => {
      const pantryJsonPath = join(tempDir, 'pantry.json')

      // Test patch
      writeFileSync(pantryJsonPath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      await versionBump({ release: 'patch', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(JSON.parse(readFileSync(pantryJsonPath, 'utf-8')).version).toBe('1.0.1')

      // Test minor
      writeFileSync(pantryJsonPath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      await versionBump({ release: 'minor', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(JSON.parse(readFileSync(pantryJsonPath, 'utf-8')).version).toBe('1.1.0')

      // Test major
      writeFileSync(pantryJsonPath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))
      await versionBump({ release: 'major', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(JSON.parse(readFileSync(pantryJsonPath, 'utf-8')).version).toBe('2.0.0')
    })

    it('should handle pantry.json without package.json', async () => {
      const pantryJsonPath = join(tempDir, 'pantry.json')
      writeFileSync(pantryJsonPath, JSON.stringify({
        name: 'pantry-only',
        version: '0.5.0',
      }, null, 2))

      await versionBump({
        release: 'minor',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = JSON.parse(readFileSync(pantryJsonPath, 'utf-8'))
      expect(updatedContent.version).toBe('0.6.0')
    })
  })

  describe('pantry.jsonc support', () => {
    it('should bump version in pantry.jsonc with comments', async () => {
      const pantryJsoncPath = join(tempDir, 'pantry.jsonc')
      writeFileSync(pantryJsoncPath, `{
  // Package configuration
  "name": "test-package",
  "version": "2.0.0", // Current version
  "description": "Test pantry package"
}`)

      await versionBump({
        release: 'patch',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(pantryJsoncPath, 'utf-8')
      expect(updatedContent).toContain('"version": "2.0.1"')
      expect(updatedContent).toContain('// Package configuration')
      expect(updatedContent).toContain('// Current version')
    })

    it('should bump version in pantry.jsonc with block comments', async () => {
      const pantryJsoncPath = join(tempDir, 'pantry.jsonc')
      writeFileSync(pantryJsoncPath, `{
  /*
   * Pantry package configuration
   */
  "name": "test-package",
  "version": "3.5.0",
  "description": "Test package"
}`)

      await versionBump({
        release: 'minor',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(pantryJsoncPath, 'utf-8')
      expect(updatedContent).toContain('"version": "3.6.0"')
      expect(updatedContent).toContain('/*')
    })
  })

  describe('package.jsonc support', () => {
    it('should bump version in package.jsonc with comments', async () => {
      const packageJsoncPath = join(tempDir, 'package.jsonc')
      writeFileSync(packageJsoncPath, `{
  // Main package file
  "name": "test-package",
  "version": "1.5.0",
  "description": "Test package"
}`)

      await versionBump({
        release: 'major',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(packageJsoncPath, 'utf-8')
      expect(updatedContent).toContain('"version": "2.0.0"')
      expect(updatedContent).toContain('// Main package file')
    })
  })

  describe('build.zig.zon support', () => {
    it('should bump version in build.zig.zon', async () => {
      const zigZonPath = join(tempDir, 'build.zig.zon')
      writeFileSync(zigZonPath, `.{
    .name = .mypackage,
    .version = "1.0.0",
    .minimum_zig_version = "0.15.1",
    .dependencies = .{},
}`)

      await versionBump({
        release: 'patch',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(zigZonPath, 'utf-8')
      expect(updatedContent).toContain('.version = "1.0.1"')
    })

    it('should bump version in build.zig.zon with all release types', async () => {
      const zigZonPath = join(tempDir, 'build.zig.zon')

      // Test patch
      writeFileSync(zigZonPath, '.{\n    .name = .test,\n    .version = "2.0.0",\n}')
      await versionBump({ release: 'patch', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(readFileSync(zigZonPath, 'utf-8')).toContain('.version = "2.0.1"')

      // Test minor
      writeFileSync(zigZonPath, '.{\n    .name = .test,\n    .version = "2.0.0",\n}')
      await versionBump({ release: 'minor', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(readFileSync(zigZonPath, 'utf-8')).toContain('.version = "2.1.0"')

      // Test major
      writeFileSync(zigZonPath, '.{\n    .name = .test,\n    .version = "2.0.0",\n}')
      await versionBump({ release: 'major', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(readFileSync(zigZonPath, 'utf-8')).toContain('.version = "3.0.0"')
    })

    it('should bump version in build.zig.zon with full configuration', async () => {
      const zigZonPath = join(tempDir, 'build.zig.zon')
      writeFileSync(zigZonPath, `.{
    // This is a comment
    .name = .zig,
    // This is a [Semantic Version](https://semver.org/).
    .version = "0.5.0",
    .fingerprint = 0xc1ce1081251b5ee1,
    .minimum_zig_version = "0.15.1",
    .dependencies = .{},
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
    },
}`)

      await versionBump({
        release: 'minor',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(zigZonPath, 'utf-8')
      expect(updatedContent).toContain('.version = "0.6.0"')
      expect(updatedContent).toContain('.fingerprint = 0xc1ce1081251b5ee1')
      expect(updatedContent).toContain('// This is a comment')
    })

    it('should handle build.zig.zon without other package files', async () => {
      const zigZonPath = join(tempDir, 'build.zig.zon')
      writeFileSync(zigZonPath, `.{
    .name = .standalone,
    .version = "0.1.0",
}`)

      await versionBump({
        release: '0.2.0',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(zigZonPath, 'utf-8')
      expect(updatedContent).toContain('.version = "0.2.0"')
    })
  })

  describe('Multiple file types together', () => {
    it('should bump version in all file types simultaneously', async () => {
      const packageJsonPath = join(tempDir, 'package.json')
      const pantryJsonPath = join(tempDir, 'pantry.json')
      const pantryJsoncPath = join(tempDir, 'pantry.jsonc')
      const packageJsoncPath = join(tempDir, 'package.jsonc')
      const zigZonPath = join(tempDir, 'build.zig.zon')

      writeFileSync(packageJsonPath, JSON.stringify({ name: 'pkg', version: '1.0.0' }, null, 2))
      writeFileSync(pantryJsonPath, JSON.stringify({ name: 'pantry', version: '1.0.0' }, null, 2))
      writeFileSync(pantryJsoncPath, '{ "name": "pantry-c", "version": "1.0.0" }')
      writeFileSync(packageJsoncPath, '{ "name": "pkg-c", "version": "1.0.0" }')
      writeFileSync(zigZonPath, '.{\n    .name = .zig,\n    .version = "1.0.0",\n}')

      await versionBump({
        release: 'minor',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      expect(JSON.parse(readFileSync(packageJsonPath, 'utf-8')).version).toBe('1.1.0')
      expect(JSON.parse(readFileSync(pantryJsonPath, 'utf-8')).version).toBe('1.1.0')
      expect(readFileSync(pantryJsoncPath, 'utf-8')).toContain('"version": "1.1.0"')
      expect(readFileSync(packageJsoncPath, 'utf-8')).toContain('"version": "1.1.0"')
      expect(readFileSync(zigZonPath, 'utf-8')).toContain('.version = "1.1.0"')
    })

    it('should handle mixed versions across file types with forceUpdate', async () => {
      const pantryJsonPath = join(tempDir, 'pantry.json')
      const zigZonPath = join(tempDir, 'build.zig.zon')

      writeFileSync(pantryJsonPath, JSON.stringify({ name: 'pantry', version: '2.0.0' }, null, 2))
      writeFileSync(zigZonPath, '.{\n    .name = .zig,\n    .version = "1.5.0",\n}')

      await versionBump({
        release: '3.0.0',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
        forceUpdate: true,
      })

      expect(JSON.parse(readFileSync(pantryJsonPath, 'utf-8')).version).toBe('3.0.0')
      expect(readFileSync(zigZonPath, 'utf-8')).toContain('.version = "3.0.0"')
    })

    it('should handle multiple file types in subdirectories with recursive flag', async () => {
      const subDir = join(tempDir, 'packages', 'sub-package')
      mkdirSync(subDir, { recursive: true })

      const rootPantryPath = join(tempDir, 'pantry.json')
      const subPantryPath = join(subDir, 'pantry.json')
      const subZigZonPath = join(subDir, 'build.zig.zon')

      writeFileSync(rootPantryPath, JSON.stringify({ name: 'root', version: '1.0.0' }, null, 2))
      writeFileSync(subPantryPath, JSON.stringify({ name: 'sub', version: '1.0.0' }, null, 2))
      writeFileSync(subZigZonPath, '.{\n    .name = .sub,\n    .version = "1.0.0",\n}')

      await versionBump({
        release: 'patch',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
        recursive: true,
      })

      expect(JSON.parse(readFileSync(rootPantryPath, 'utf-8')).version).toBe('1.0.1')
      expect(JSON.parse(readFileSync(subPantryPath, 'utf-8')).version).toBe('1.0.1')
      expect(readFileSync(subZigZonPath, 'utf-8')).toContain('.version = "1.0.1"')
    })
  })

  describe('Edge cases', () => {
    it('should handle build.zig.zon with different spacing', async () => {
      const zigZonPath = join(tempDir, 'build.zig.zon')

      // Test with extra spaces
      writeFileSync(zigZonPath, '.{\n    .version   =   "1.0.0"  ,\n}')
      await versionBump({ release: 'patch', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(readFileSync(zigZonPath, 'utf-8')).toContain('"1.0.1"')

      // Test with tabs
      writeFileSync(zigZonPath, '.{\n\t.version\t=\t"2.0.0"\t,\n}')
      await versionBump({ release: 'patch', cwd: tempDir, commit: false, tag: false, push: false, noGitCheck: true })
      expect(readFileSync(zigZonPath, 'utf-8')).toContain('"2.0.1"')
    })

    it('should preserve file formatting in pantry.jsonc', async () => {
      const pantryJsoncPath = join(tempDir, 'pantry.jsonc')
      const originalContent = `{
  // Configuration
  "name": "test",
  "version": "1.0.0",
  // More config
  "description": "Test"
}`
      writeFileSync(pantryJsoncPath, originalContent)

      await versionBump({
        release: 'patch',
        cwd: tempDir,
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
      })

      const updatedContent = readFileSync(pantryJsoncPath, 'utf-8')
      expect(updatedContent).toContain('"version": "1.0.1"')
      expect(updatedContent).toContain('// Configuration')
      expect(updatedContent).toContain('// More config')
    })
  })
})
