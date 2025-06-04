import { describe, expect, it } from 'bun:test'

describe('bumpx exports', () => {
  it('should export main functions and types', async () => {
    const bumpx = await import('../src/index')

    // Check that main functions are exported
    expect(typeof bumpx.versionBump).toBe('function')
    expect(typeof bumpx.loadBumpConfig).toBe('function')
    expect(typeof bumpx.defineConfig).toBe('function')

    // Check that utilities are exported
    expect(typeof bumpx.incrementVersion).toBe('function')
    expect(typeof bumpx.findPackageJsonFiles).toBe('function')
    expect(typeof bumpx.readPackageJson).toBe('function')
    expect(typeof bumpx.writePackageJson).toBe('function')

    // Check that types are exported
    expect(bumpx.ProgressEvent).toBeDefined()
    expect(bumpx.ExitCode).toBeDefined()

    // Check config defaults
    expect(bumpx.defaultConfig).toBeDefined()
    expect(typeof bumpx.defaultConfig).toBe('object')
  })

  it('should have proper enum values', async () => {
    const { ProgressEvent, ExitCode } = await import('../src/index')

    // Test ProgressEvent enum
    expect(ProgressEvent.FileUpdated).toBe('fileUpdated' as typeof ProgressEvent.FileUpdated)
    expect(ProgressEvent.GitCommit).toBe('gitCommit' as typeof ProgressEvent.GitCommit)
    expect(ProgressEvent.GitTag).toBe('gitTag' as typeof ProgressEvent.GitTag)
    expect(ProgressEvent.GitPush).toBe('gitPush' as typeof ProgressEvent.GitPush)

    // Test ExitCode enum
    expect(ExitCode.Success).toBe(0)
    expect(ExitCode.InvalidArgument).toBe(1)
    expect(ExitCode.FatalError).toBe(2)
  })

  it('should export configuration defaults with expected values', async () => {
    const { defaultConfig } = await import('../src/index')

    expect(defaultConfig.commit).toBe(true)
    expect(defaultConfig.tag).toBe(true)
    expect(defaultConfig.push).toBe(true)
    expect(defaultConfig.sign).toBe(false)
    expect(defaultConfig.confirm).toBe(true)
    expect(defaultConfig.quiet).toBe(false)
    expect(defaultConfig.recursive).toBe(false)
  })

  it('should have working utility functions', async () => {
    const { incrementVersion } = await import('../src/index')

    expect(incrementVersion('1.0.0', 'patch')).toBe('1.0.1')
    expect(incrementVersion('1.0.0', 'minor')).toBe('1.1.0')
    expect(incrementVersion('1.0.0', 'major')).toBe('2.0.0')
  })

  it('should export defineConfig helper', async () => {
    const { defineConfig } = await import('../src/index')

    const config = defineConfig({
      commit: false,
      tag: true,
      push: false,
    })

    expect(config.commit).toBe(false)
    expect(config.tag).toBe(true)
    expect(config.push).toBe(false)
  })
})
