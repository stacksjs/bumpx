import type { BumpxConfig, VersionBumpOptions } from './types'
// @ts-expect-error - bunfig types have an issue atm but functionality works properly
import { loadConfig } from 'bunfig'

export const bumpConfigDefaults: BumpxConfig = {
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

  // Advanced options
  all: false,
  recursive: false,
  printCommits: false,
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: BumpxConfig = await loadConfig({
  name: 'bumpx',
  defaultConfig: bumpConfigDefaults,
})

/**
 * Load bumpx configuration with overrides
 */
export async function loadBumpConfig(overrides: Partial<VersionBumpOptions> = {}): Promise<VersionBumpOptions> {
  return {
    ...config,
    ...overrides,
  }
}

/**
 * Define configuration helper for TypeScript config files
 */
export function defineConfig(config: VersionBumpOptions): VersionBumpOptions {
  return config
}
