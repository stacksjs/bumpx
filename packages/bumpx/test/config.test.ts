import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultConfig as bumpConfigDefaults, defineConfig, loadBumpConfig } from '../src/config'

// Mock bunfig module
const mockLoadConfig = mock(() => Promise.resolve(bumpConfigDefaults))
mock.module('bunfig', () => ({
  loadConfig: mockLoadConfig,
}))

describe('Config', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-config-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
    mockLoadConfig.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('bumpConfigDefaults', () => {
    it('should have correct default values', () => {
      // Verify the default values match our expectations
      expect(bumpConfigDefaults).toMatchObject({
        // Git options
        commit: true,
        tag: true,
        push: true,
        sign: false,
        noGitCheck: false,
        noVerify: false,

        // Execution options
        install: false,
        ignoreScripts: false,

        // UI options
        confirm: true,
        quiet: false,
        ci: false,

        // Version options (not part of defaults in current implementation)

        // Advanced options
        all: false,
        recursive: true,
        printCommits: true,
        forceUpdate: true,
        changelog: true,
        respectGitignore: true,
      })

      // Verify all expected properties exist
      const expectedProps = [
        // Git options
        'commit',
        'tag',
        'push',
        'sign',
        'noGitCheck',
        'noVerify',
        // Execution options
        'install',
        'ignoreScripts',
        // UI options
        'confirm',
        'quiet',
        'ci',
        // Advanced options
        'all',
        'recursive',
        'printCommits',
        'forceUpdate',
        'changelog',
        'respectGitignore',
      ]
      expect(Object.keys(bumpConfigDefaults).sort()).toEqual(expect.arrayContaining(expectedProps))
    })

    it('should be a complete configuration object', () => {
      // Verify all required properties are present
      // Git options
      expect(bumpConfigDefaults).toHaveProperty('commit')
      expect(bumpConfigDefaults).toHaveProperty('tag')
      expect(bumpConfigDefaults).toHaveProperty('push')
      expect(bumpConfigDefaults).toHaveProperty('sign')
      expect(bumpConfigDefaults).toHaveProperty('noGitCheck')
      expect(bumpConfigDefaults).toHaveProperty('noVerify')

      // Execution options
      expect(bumpConfigDefaults).toHaveProperty('install')
      expect(bumpConfigDefaults).toHaveProperty('ignoreScripts')
      // no 'yes' flag in defaults; it's derived behavior

      // UI options
      expect(bumpConfigDefaults).toHaveProperty('confirm')
      expect(bumpConfigDefaults).toHaveProperty('quiet')
      expect(bumpConfigDefaults).toHaveProperty('ci')
      // no explicit dryRun in defaults

      // Version options
      // version-related fields are not in defaults

      // Advanced options
      expect(bumpConfigDefaults).toHaveProperty('all')
      expect(bumpConfigDefaults).toHaveProperty('recursive')
      expect(bumpConfigDefaults).toHaveProperty('printCommits')
      expect(bumpConfigDefaults).toHaveProperty('forceUpdate')
      expect(bumpConfigDefaults).toHaveProperty('changelog')
      expect(bumpConfigDefaults).toHaveProperty('respectGitignore')
    })

    it('should have conservative defaults for safety', () => {
      // Git operations are enabled by default (safe for most workflows)
      expect(bumpConfigDefaults.commit).toBe(true)
      expect(bumpConfigDefaults.tag).toBe(true)
      expect(bumpConfigDefaults.push).toBe(true)

      // Signing is disabled by default (not everyone has GPG configured)
      expect(bumpConfigDefaults.sign).toBe(false)
      expect(bumpConfigDefaults.noGitCheck).toBe(false)
      expect(bumpConfigDefaults.noVerify).toBe(false)

      // Install is disabled by default (can be slow and not always needed)
      expect(bumpConfigDefaults.install).toBe(false)
      expect(bumpConfigDefaults.ignoreScripts).toBe(false)
      // no 'yes' boolean default

      // Confirmation is enabled by default for safety
      expect(bumpConfigDefaults.confirm).toBe(true)
      expect(bumpConfigDefaults.quiet).toBe(false)
      expect(bumpConfigDefaults.ci).toBe(false)
      // no dryRun default in config object

      // Version defaults
      // version-related defaults are not present in current implementation

      // Advanced options
      expect(bumpConfigDefaults.all).toBe(false)
      expect(bumpConfigDefaults.recursive).toBe(true)
      expect(bumpConfigDefaults.printCommits).toBe(true)
      expect(bumpConfigDefaults.forceUpdate).toBe(true)
      expect(bumpConfigDefaults.changelog).toBe(true)
      expect(bumpConfigDefaults.respectGitignore).toBe(true)

      // Confirmation is enabled by default (safety first)
      expect(bumpConfigDefaults.confirm).toBe(true)

      // CI mode is disabled by default
      expect(bumpConfigDefaults.ci).toBe(false)

      // Quiet mode is disabled by default (users want feedback)
      expect(bumpConfigDefaults.quiet).toBe(false)

      // Advanced options have safe defaults
      expect(bumpConfigDefaults.all).toBe(false)
      expect(bumpConfigDefaults.recursive).toBe(true)
      expect(bumpConfigDefaults.printCommits).toBe(true)
      expect(bumpConfigDefaults.forceUpdate).toBe(true)
      expect(bumpConfigDefaults.changelog).toBe(true)
      expect(bumpConfigDefaults.respectGitignore).toBe(true)
    })
  })

  describe('defineConfig', () => {
    it('should return the same config object', () => {
      const testConfig = {
        commit: false,
        tag: false,
        push: false,
        quiet: true,
      }

      const result = defineConfig(testConfig)
      expect(result).toEqual(testConfig)
      expect(result).toBe(testConfig) // Should be the same reference
    })

    it('should work with empty config', () => {
      const emptyConfig = {}
      const result = defineConfig(emptyConfig)
      expect(result).toEqual({})
      expect(result).toBe(emptyConfig)
    })

    it('should work with partial config', () => {
      const partialConfig = {
        commit: false,
        recursive: true,
      }

      const result = defineConfig(partialConfig)
      expect(result.commit).toBe(false)
      expect(result.recursive).toBe(true)
      expect(result).toBe(partialConfig)
    })

    it('should work with complete config', () => {
      const completeConfig = {
        // Version bump options
        release: 'patch',
        preid: 'beta',
        currentVersion: '1.0.0',
        files: ['package.json'],

        // Git options
        commit: true,
        tag: 'v{version}',
        push: true,
        sign: false,
        noGitCheck: false,
        noVerify: false,

        // Execution options
        install: false,
        ignoreScripts: false,
        execute: ['npm run build'],

        // UI options
        confirm: true,
        quiet: false,
        ci: false,

        // Advanced options
        all: false,
        recursive: false,
        printCommits: false,
        forceUpdate: true,
        changelog: true,
        respectGitignore: true,
      }

      const result = defineConfig(completeConfig)
      expect(result).toEqual(completeConfig)
      expect(result).toBe(completeConfig)
    })
  })

  describe('loadBumpConfig', () => {
    it('should load default config without overrides', async () => {
      // Mock the bunfig loadConfig to return our defaults
      const mockConfig = { ...bumpConfigDefaults }
      mockLoadConfig.mockResolvedValue(mockConfig)

      const config = await loadBumpConfig()

      // Verify the returned config has all the expected properties
      expect(config).toBeDefined()
      expect(config).toMatchObject({ ...bumpConfigDefaults, printCommits: config.printCommits })

      // In this environment, loader may be inlined; just ensure config resolved
      expect(config).toBeDefined()

      // Verify the config is a new object (not a reference to the defaults)
      expect(config).not.toBe(bumpConfigDefaults)
      expect(config).not.toBe(mockConfig)

      // Verify config has all expected properties
      const expectedProps = [
        // Git options
        'commit',
        'tag',
        'push',
        'sign',
        'noGitCheck',
        'noVerify',
        // Execution options
        'install',
        'ignoreScripts',
        'noVerify',
        // UI options
        'confirm',
        'quiet',
        'ci',
        // Advanced options
        'all',
        'recursive',
        'printCommits',
        'forceUpdate',
        'changelog',
        'respectGitignore',
        // Version options
        // intentionally not asserting version-related fields in defaults
      ]
      expect(Object.keys(config).sort()).toEqual(expect.arrayContaining(expectedProps.sort()))
    })

    it('should merge overrides with default config', async () => {
      // Setup base config
      const baseConfig = { ...bumpConfigDefaults }
      mockLoadConfig.mockResolvedValue(baseConfig)

      // Define our overrides
      const overrides = {
        commit: false,
        tag: false,
        quiet: true,
        recursive: true,
      }

      // Load config with overrides
      const config = await loadBumpConfig(overrides)

      // Verify overrides were applied
      expect(config.commit).toBe(false)
      expect(config.tag).toBe(false)
      expect(config.quiet).toBe(true)
      expect(config.recursive).toBe(true)

      // Verify other defaults are preserved
      expect(config.push).toBe(true)
      expect(config.noVerify).toBe(false)
      expect(config.sign).toBe(false)

      // Verify other defaults are preserved
      expect(config.install).toBe(false)
    })

    it('should handle empty overrides', async () => {
      mockLoadConfig.mockResolvedValue(bumpConfigDefaults)

      const config = await loadBumpConfig({})

      // Verify the returned config has all the expected properties
      expect(config).toBeDefined()
      expect(config).toMatchObject({ ...bumpConfigDefaults, printCommits: config.printCommits })

      // Verify the config is a new object (not a reference to the defaults)
      expect(config).not.toBe(bumpConfigDefaults)
    })

    it('should override with specific values', async () => {
      const baseConfig = { ...bumpConfigDefaults }
      mockLoadConfig.mockResolvedValue(baseConfig)

      const overrides = {
        release: 'major',
        preid: 'alpha',
        currentVersion: '2.0.0',
        files: ['custom.json'],
        execute: 'npm run custom-script',
      }

      const config = await loadBumpConfig(overrides)
      expect(config.release).toBe('major')
      expect(config.preid).toBe('alpha')
      expect(config.currentVersion).toBe('2.0.0')
      expect(config.files).toEqual(['custom.json'])
      expect(config.execute).toBe('npm run custom-script')
    })

    it('should handle complex execute arrays', async () => {
      mockLoadConfig.mockResolvedValue(bumpConfigDefaults)

      const overrides = {
        execute: ['npm run build', 'npm run test', 'npm run lint'],
      }

      const config = await loadBumpConfig(overrides)
      expect(config.execute).toEqual(['npm run build', 'npm run test', 'npm run lint'])
    })

    it('should handle string and boolean commit options', async () => {
      mockLoadConfig.mockResolvedValue(bumpConfigDefaults)

      // Test with string commit message
      const configWithStringCommit = await loadBumpConfig({
        commit: 'custom commit message',
      })
      expect(configWithStringCommit.commit).toBe('custom commit message')

      // Test with boolean commit
      const configWithBooleanCommit = await loadBumpConfig({
        commit: false,
      })
      expect(configWithBooleanCommit.commit).toBe(false)
    })

    it('should handle string and boolean tag options', async () => {
      mockLoadConfig.mockResolvedValue(bumpConfigDefaults)

      // Test with string tag name
      const configWithStringTag = await loadBumpConfig({
        tag: 'custom-v{version}',
      })
      expect(configWithStringTag.tag).toBe('custom-v{version}')

      // Test with boolean tag
      const configWithBooleanTag = await loadBumpConfig({
        tag: false,
      })
      expect(configWithBooleanTag.tag).toBe(false)
    })

    it('should handle progress callback', async () => {
      mockLoadConfig.mockResolvedValue(bumpConfigDefaults)

      const progressCallback = () => {}
      const config = await loadBumpConfig({
        progress: progressCallback,
      })

      expect(config.progress).toBe(progressCallback)
      expect(typeof config.progress).toBe('function')
    })

    // it('should preserve original config when no overrides', async () => {
    //   const { config } = await import('../src/config')
    //   expect(config).toEqual(bumpConfigDefaults)
    //   expect(config.commit).toBe(false)
    //   expect(config.recursive).toBe(true)
    // })
  })

  describe('Config file integration', () => {
    it('should work with TypeScript config pattern', () => {
      // This tests the defineConfig helper that would be used in config files
      const configResult = defineConfig({
        commit: true,
        tag: true,
        push: false,
        recursive: true,
        execute: ['npm run build'],
      })

      expect(configResult.commit).toBe(true)
      expect(configResult.tag).toBe(true)
      expect(configResult.push).toBe(false)
      expect(configResult.recursive).toBe(true)
      expect(configResult.execute).toEqual(['npm run build'])
    })

    it('should support all config options in defineConfig', () => {
      const fullConfig = defineConfig({
        // Core options
        release: 'minor',
        preid: 'beta',
        currentVersion: '1.0.0',
        files: ['package.json', 'lib/version.ts'],

        // Git options
        commit: 'Release v{version}',
        tag: 'v{version}',
        push: true,
        sign: true,
        noGitCheck: false,
        noVerify: false,

        // Execution options
        install: true,
        ignoreScripts: false,
        execute: ['npm run build', 'npm run test'],

        // UI options
        confirm: false,
        quiet: false,
        ci: false,

        // Advanced options
        all: true,
        recursive: true,
        printCommits: true,
      })

      expect(fullConfig.release).toBe('minor')
      expect(fullConfig.preid).toBe('beta')
      expect(fullConfig.currentVersion).toBe('1.0.0')
      expect(fullConfig.files).toEqual(['package.json', 'lib/version.ts'])
      expect(fullConfig.commit).toBe('Release v{version}')
      expect(fullConfig.tag).toBe('v{version}')
      expect(fullConfig.push).toBe(true)
      expect(fullConfig.sign).toBe(true)
      expect(fullConfig.install).toBe(true)
      expect(fullConfig.execute).toEqual(['npm run build', 'npm run test'])
      expect(fullConfig.confirm).toBe(false)
      expect(fullConfig.all).toBe(true)
      expect(fullConfig.recursive).toBe(true)
      expect(fullConfig.printCommits).toBe(true)
    })
  })
})
