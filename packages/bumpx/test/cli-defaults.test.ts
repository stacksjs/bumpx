import { describe, expect, it } from 'bun:test'
import { defaultConfig } from '../src/config'

describe('CLI Default Configuration', () => {
  it('should have correct default values', () => {
    // Verify that the default configuration enables commit, tag, and push
    expect(defaultConfig.commit).toBe(true)
    expect(defaultConfig.tag).toBe(true)
    expect(defaultConfig.push).toBe(true)
    expect(defaultConfig.recursive).toBe(true)
    expect(defaultConfig.forceUpdate).toBe(true)
  })

  it('should have sensible defaults for safety options', () => {
    // Verify safety defaults
    expect(defaultConfig.sign).toBe(false)
    expect(defaultConfig.noGitCheck).toBe(false)
    expect(defaultConfig.noVerify).toBe(false)
    expect(defaultConfig.install).toBe(false)
    expect(defaultConfig.ignoreScripts).toBe(false)
  })

  it('should have appropriate UI defaults', () => {
    // Verify UI defaults
    expect(defaultConfig.confirm).toBe(true)
    expect(defaultConfig.quiet).toBe(false)
    expect(defaultConfig.ci).toBe(false)
    expect(defaultConfig.all).toBe(false)
    expect(defaultConfig.printCommits).toBe(false)
  })
})
