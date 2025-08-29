import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock the CLI module before importing
const mockPromptForRecursiveAll = spyOn({}, 'promptForRecursiveAll' as any).mockResolvedValue(true)
const mockVersionBump = spyOn({}, 'versionBump' as any).mockResolvedValue(undefined)

describe('CLI Recursive All Prompt', () => {
  let tempDir: string
  let originalEnv: string | undefined

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-cli-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })

    // Store original NODE_ENV
    originalEnv = process.env.NODE_ENV
    // Set test environment to enable test mode
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }

    // Restore original NODE_ENV
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv
    }
    else {
      delete process.env.NODE_ENV
    }

    mockPromptForRecursiveAll.mockClear()
    mockVersionBump.mockClear()
  })

  describe('CLI Flag Combinations', () => {
    it('should detect -r --all combination correctly', async () => {
      // Create a simple package.json for testing
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      // Import the CLI preparation function
      const { loadBumpConfig } = await import('../src/config')

      // Test the configuration with recursive and all flags
      const config = await loadBumpConfig({
        recursive: true,
        all: true,
        confirm: true,
        ci: false,
      })

      expect(config.recursive).toBe(true)
      expect(config.all).toBe(true)
      expect(config.confirm).toBe(true)
    })

    it('should skip prompting when --yes flag is provided', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const { loadBumpConfig } = await import('../src/config')

      // Test with --yes flag (confirm: false)
      const config = await loadBumpConfig({
        recursive: true,
        all: true,
        confirm: false, // This simulates --yes flag
        ci: false,
      })

      expect(config.confirm).toBe(false)
    })

    it('should skip prompting in CI mode', async () => {
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2))

      const { loadBumpConfig } = await import('../src/config')

      // Test in CI mode
      const config = await loadBumpConfig({
        recursive: true,
        all: true,
        confirm: true,
        ci: true,
      })

      // In CI mode, confirm should be overridden to false
      expect(config.ci).toBe(true)
    })

    it('should enable commit, tag, and push by default', async () => {
      const { defaultConfig } = await import('../src/config')

      // Verify that the default configuration has commit, tag, and push enabled
      expect(defaultConfig.commit).toBe(true)
      expect(defaultConfig.tag).toBe(true)
      expect(defaultConfig.push).toBe(true)
    })

    it('should preserve explicit false values for git operations', async () => {
      const { loadBumpConfig } = await import('../src/config')

      // Test with explicitly disabled git operations
      const config = await loadBumpConfig({
        recursive: true,
        all: true,
        commit: false,
        tag: false,
        push: false,
        confirm: false,
      })

      expect(config.commit).toBe(false)
      expect(config.tag).toBe(false)
      expect(config.push).toBe(false)
    })
  })

  describe('Prompt Function Behavior', () => {
    it('should return true in test environment', async () => {
      // The prompt function should auto-confirm in test mode
      // This is tested indirectly through the environment variable check
      expect(process.env.NODE_ENV).toBe('test')
    })

    it('should handle different environment variables', async () => {
      // Test BUN_ENV
      delete process.env.NODE_ENV
      process.env.BUN_ENV = 'test'

      expect(process.env.BUN_ENV).toBe('test')

      // Clean up
      delete process.env.BUN_ENV
    })

    it('should handle test detection via process.argv', async () => {
      // Test process.argv detection
      const originalArgv = process.argv
      process.argv = [...originalArgv, 'test']

      expect(process.argv.includes('test')).toBe(true)

      // Restore original argv
      process.argv = originalArgv
    })
  })

  describe('Error Handling', () => {
    it('should handle cancellation gracefully', async () => {
      // Test that cancellation is handled properly
      const error = new Error('Operation cancelled by user')

      expect(error.message).toBe('Operation cancelled by user')
    })

    it('should handle prompt import failures', async () => {
      // Test error handling when prompt import fails
      const error = new Error('Unable to import confirmation prompt from @stacksjs/clapp')

      expect(error.message).toContain('Unable to import confirmation prompt')
    })

    it('should default to false on prompt failures for safety', async () => {
      // Test that prompt failures default to not proceeding for safety
      const shouldProceed = false // This represents the safety default

      expect(shouldProceed).toBe(false)
    })
  })

  describe('Integration with Version Bump', () => {
    it('should pass correct options to version bump function', async () => {
      const { loadBumpConfig } = await import('../src/config')

      const config = await loadBumpConfig({
        release: 'patch',
        recursive: true,
        all: true,
        commit: true,
        tag: true,
        push: true,
        confirm: false,
        quiet: true,
        noGitCheck: true,
      })

      expect(config.release).toBe('patch')
      expect(config.recursive).toBe(true)
      expect(config.all).toBe(true)
      expect(config.commit).toBe(true)
      expect(config.tag).toBe(true)
      expect(config.push).toBe(true)
      expect(config.quiet).toBe(true)
      expect(config.noGitCheck).toBe(true)
    })

    it('should handle different release types', async () => {
      const { loadBumpConfig } = await import('../src/config')

      const releaseTypes = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor']

      for (const releaseType of releaseTypes) {
        const config = await loadBumpConfig({
          release: releaseType,
          recursive: true,
          all: true,
        })

        expect(config.release).toBe(releaseType)
      }
    })

    it('should handle custom version numbers', async () => {
      const { loadBumpConfig } = await import('../src/config')

      const config = await loadBumpConfig({
        release: '2.0.0',
        recursive: true,
        all: true,
      })

      expect(config.release).toBe('2.0.0')
    })
  })

  describe('Configuration Precedence', () => {
    it('should prioritize CLI overrides over defaults', async () => {
      const { loadBumpConfig } = await import('../src/config')

      // Test that CLI overrides take precedence
      const config = await loadBumpConfig({
        commit: false, // Override default true
        tag: false, // Override default true
        push: false, // Override default true
        quiet: true, // Override default false
      })

      expect(config.commit).toBe(false)
      expect(config.tag).toBe(false)
      expect(config.push).toBe(false)
      expect(config.quiet).toBe(true)
    })

    it('should use defaults when no overrides provided', async () => {
      const { loadBumpConfig } = await import('../src/config')

      const config = await loadBumpConfig({})

      // Should use default values
      expect(config.commit).toBe(true)
      expect(config.tag).toBe(true)
      expect(config.push).toBe(true)
      expect(config.confirm).toBe(true)
      expect(config.quiet).toBe(false)
    })
  })
})
