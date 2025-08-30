import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { versionBump } from '../src/version-bump'

describe('Changelog Generation', () => {
  let tempDir: string

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = join(tmpdir(), `bumpx-changelog-test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`)
    mkdirSync(tempDir, { recursive: true })

    // Initialize git repository
    spawnSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' })
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir, stdio: 'ignore' })
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'ignore' })
  })

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
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
      const fixtureDir = join(__dirname, 'fixtures', 'changelog-generation')
      const outputDir = join(__dirname, 'output', 'changelog-generation', 'disabled')
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
        changelog: false, // Explicitly disabled
        quiet: true,
        noGitCheck: true,
        cwd: outputDir,
      })

      // Verify changelog file was NOT created
      const changelogPath = join(outputDir, 'CHANGELOG.md')
      expect(existsSync(changelogPath)).toBe(false)

      // Verify package.json was still updated
      const updatedPackage = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedPackage.version).toBe('1.0.1')
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
      const fixtureDir = join(__dirname, 'fixtures', 'changelog-generation')
      const outputDir = join(__dirname, 'output', 'changelog-generation', 'tag-disabled')
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
        tag: false, // Tag disabled
        push: false,
        changelog: true,
        quiet: true,
        noGitCheck: true,
        cwd: outputDir,
      })

      // Verify changelog file was created even with tag disabled
      const changelogPath = join(outputDir, 'CHANGELOG.md')
      expect(existsSync(changelogPath)).toBe(true)

      // Verify package.json was updated
      const updatedPackage = JSON.parse(readFileSync(packagePath, 'utf-8'))
      expect(updatedPackage.version).toBe('1.0.1')
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
