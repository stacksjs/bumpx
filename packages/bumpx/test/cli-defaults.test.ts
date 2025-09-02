import { describe, expect, it } from 'bun:test'
import { defaultConfig } from '../src/config'

describe('CLI Default Configuration', () => {
  it('should have correct default values', () => {
    // Verify defaultConfig exists and is an object
    expect(defaultConfig).toBeDefined()
    expect(typeof defaultConfig).toBe('object')
    
    // Define expected defaults
    const expectedDefaults = {
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
      
      // Advanced options
      all: false,
      recursive: true,
      printCommits: true,
      forceUpdate: true,
      changelog: true,
      respectGitignore: true,
    }
    
    // Verify all expected properties exist and have correct values
    const config = defaultConfig as Record<string, unknown>
    Object.entries(expectedDefaults).forEach(([key, expectedValue]) => {
      expect(config).toHaveProperty(key)
      expect(config[key]).toBe(expectedValue)
    })
    
    // Verify no extra properties exist
    expect(Object.keys(defaultConfig).sort()).toEqual(Object.keys(expectedDefaults).sort())
    
    // Ensure all properties are present and have the correct type
    const expectedProps = {
      // Git options
      commit: 'boolean',
      tag: 'boolean',
      push: 'boolean',
      sign: 'boolean',
      noGitCheck: 'boolean',
      noVerify: 'boolean',
      
      // Execution options
      install: 'boolean',
      ignoreScripts: 'boolean',
      
      // UI options
      confirm: 'boolean',
      quiet: 'boolean',
      ci: 'boolean',
      
      // Advanced options
      all: 'boolean',
      recursive: 'boolean',
      printCommits: 'boolean',
      forceUpdate: 'boolean',
      changelog: 'boolean',
      respectGitignore: 'boolean',
    }
    
    // Check each property exists and has the correct type
    expect(defaultConfig.commit).toBe(true)
    expect(defaultConfig.tag).toBe(true)
    expect(defaultConfig.push).toBe(true)
    expect(defaultConfig.sign).toBe(false)
    expect(defaultConfig.noGitCheck).toBe(false)
    expect(defaultConfig.noVerify).toBe(false)
    expect(defaultConfig.install).toBe(false)
    expect(defaultConfig.ignoreScripts).toBe(false)
    expect(defaultConfig.confirm).toBe(true)
    expect(defaultConfig.quiet).toBe(false)
    expect(defaultConfig.ci).toBe(false)
    expect(defaultConfig.all).toBe(false)
    expect(defaultConfig.recursive).toBe(true)
    expect(defaultConfig.printCommits).toBe(true)
    expect(defaultConfig.forceUpdate).toBe(true)
    expect(defaultConfig.changelog).toBe(true)
    expect(defaultConfig.respectGitignore).toBe(true)
  })
})
