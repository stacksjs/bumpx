import type { BumpxConfig, VersionBumpOptions } from './types'
import { loadConfig } from 'bunfig'

export const defaultConfig: BumpxConfig = {
  // Git options
  commit: true,
  tag: true,
  push: true, // Enable push by default for complete workflow
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
  printCommits: false,
  forceUpdate: true,
  changelog: true, // Enable changelog generation by default
  respectGitignore: true, // Respect .gitignore by default
}

/**
 * Load bumpx configuration with overrides
 */
// eslint-disable-next-line antfu/no-top-level-await
export const config: BumpxConfig = await loadConfig({
  name: 'bumpx',
  defaultConfig,
})

export async function loadBumpConfig(overrides?: Partial<BumpxConfig>): Promise<BumpxConfig> {
  return { ...defaultConfig, ...config, ...overrides }
}

/**
 * Define configuration helper for TypeScript config files
 */
export function defineConfig(config: VersionBumpOptions): VersionBumpOptions {
  return config
}
