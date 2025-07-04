import type { BumpxConfig, VersionBumpOptions } from './types'
import { loadConfig } from 'bunfig'

export const defaultConfig: BumpxConfig = {
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
  recursive: false,
  printCommits: false,
}

/**
 * Load bumpx configuration with overrides
 */
// eslint-disable-next-line antfu/no-top-level-await
export const config: BumpxConfig = await loadConfig({
  name: 'bumpx',
  defaultConfig,
})

/**
 * Load bumpx configuration with overrides
 */
export async function loadBumpConfig(overrides?: Partial<BumpxConfig>): Promise<BumpxConfig> {
  const loaded = await loadConfig({
    name: 'bumpx',
    defaultConfig,
  })

  return { ...loaded, ...overrides }
}

/**
 * Define configuration helper for TypeScript config files
 */
export function defineConfig(config: VersionBumpOptions): VersionBumpOptions {
  return config
}
