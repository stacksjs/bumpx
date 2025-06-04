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
      expect(bumpConfigDefaults.commit).toBe(true)
      expect(bumpConfigDefaults.tag).toBe(true)
      expect(bumpConfigDefaults.push).toBe(true)
      expect(bumpConfigDefaults.sign).toBe(false)
      expect(bumpConfigDefaults.noGitCheck).toBe(false)
      expect(bumpConfigDefaults.noVerify).toBe(false)
      expect(bumpConfigDefaults.install).toBe(false)
      expect(bumpConfigDefaults.ignoreScripts).toBe(false)
      expect(bumpConfigDefaults.confirm).toBe(true)
      expect(bumpConfigDefaults.quiet).toBe(false)
      expect(bumpConfigDefaults.ci).toBe(false)
      expect(bumpConfigDefaults.all).toBe(false)
      expect(bumpConfigDefaults.recursive).toBe(false)
      expect(bumpConfigDefaults.printCommits).toBe(false)
    })

    it('should be a complete configuration object', () => {
      // Verify all required properties are present
      expect(bumpConfigDefaults).toHaveProperty('commit')
      expect(bumpConfigDefaults).toHaveProperty('tag')
      expect(bumpConfigDefaults).toHaveProperty('push')
      expect(bumpConfigDefaults).toHaveProperty('sign')
      expect(bumpConfigDefaults).toHaveProperty('noGitCheck')
      expect(bumpConfigDefaults).toHaveProperty('noVerify')
      expect(bumpConfigDefaults).toHaveProperty('install')
      expect(bumpConfigDefaults).toHaveProperty('ignoreScripts')
      expect(bumpConfigDefaults).toHaveProperty('confirm')
      expect(bumpConfigDefaults).toHaveProperty('quiet')
      expect(bumpConfigDefaults).toHaveProperty('ci')
      expect(bumpConfigDefaults).toHaveProperty('all')
      expect(bumpConfigDefaults).toHaveProperty('recursive')
      expect(bumpConfigDefaults).toHaveProperty('printCommits')
    })

    it('should have conservative defaults for safety', () => {
      // Git operations are enabled by default (safe for most workflows)
      expect(bumpConfigDefaults.commit).toBe(true)
      expect(bumpConfigDefaults.tag).toBe(true)
      expect(bumpConfigDefaults.push).toBe(true)

      // Signing is disabled by default (not everyone has GPG configured)
      expect(bumpConfigDefaults.sign).toBe(false)

      // Install is disabled by default (can be slow and not always needed)
      expect(bumpConfigDefaults.install).toBe(false)

      // Confirmation is enabled by default (safety first)
      expect(bumpConfigDefaults.confirm).toBe(true)

      // CI mode is disabled by default
      expect(bumpConfigDefaults.ci).toBe(false)

      // Quiet mode is disabled by default (users want feedback)
      expect(bumpConfigDefaults.quiet).toBe(false)
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
        release: 'patch',
        preid: 'beta',
        currentVersion: '1.0.0',
        files: ['package.json'],
        commit: true,
        tag: 'v{version}',
        push: true,
        sign: false,
        noGitCheck: false,
        noVerify: false,
        install: false,
        ignoreScripts: false,
        execute: ['npm run build'],
        confirm: true,
        quiet: false,
        ci: false,
        all: false,
        recursive: false,
        printCommits: false,
      }

      const result = defineConfig(completeConfig)
      expect(result).toEqual(completeConfig)
      expect(result).toBe(completeConfig)
    })
  })

  describe('loadBumpConfig', () => {
    it('should load default config without overrides', async () => {
      mockLoadConfig.mockResolvedValue(bumpConfigDefaults)

      const config = await loadBumpConfig()
      expect(config).toEqual(bumpConfigDefaults)
    })

    it('should merge overrides with default config', async () => {
      const baseConfig = { ...bumpConfigDefaults }
      mockLoadConfig.mockResolvedValue(baseConfig)

      const overrides = {
        commit: false,
        tag: false,
        quiet: true,
        recursive: true,
      }

      const config = await loadBumpConfig(overrides)
      expect(config.commit).toBe(false)
      expect(config.tag).toBe(false)
      expect(config.quiet).toBe(true)
      expect(config.recursive).toBe(true)

      // Should preserve other defaults
      expect(config.push).toBe(true)
      expect(config.sign).toBe(false)
      expect(config.install).toBe(false)
    })

    it('should handle empty overrides', async () => {
      mockLoadConfig.mockResolvedValue(bumpConfigDefaults)

      const config = await loadBumpConfig({})
      expect(config).toEqual(bumpConfigDefaults)
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

    it('should preserve original config when no overrides', async () => {
      const originalConfig = {
        ...bumpConfigDefaults,
        commit: false,
        recursive: true,
      }
      mockLoadConfig.mockResolvedValue(originalConfig)

      const config = await loadBumpConfig()
      expect(config).toEqual(originalConfig)
      expect(config.commit).toBe(false)
      expect(config.recursive).toBe(true)
    })
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
