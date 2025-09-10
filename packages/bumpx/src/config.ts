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
  printCommits: true,
  forceUpdate: true,
  changelog: true, // Enable changelog generation by default
  respectGitignore: true, // Respect .gitignore by default

  // GitHub Release options
  createGitHubRelease: false, // Disabled by default since it requires a token
  githubReleaseOptions: {
    draft: false,
    prerelease: false,
    generateReleaseNotes: true, // Use GitHub's auto-generated release notes by default
  },
}

/**
 * Load bumpx configuration with overrides
 */
let cachedConfig: BumpxConfig | null = null

async function getConfig(): Promise<BumpxConfig> {
  if (cachedConfig)
    return cachedConfig

  const loaded = await loadConfig({
    name: 'bumpx',
    defaultConfig,
  })

  // Merge with defaults to ensure completeness
  cachedConfig = { ...defaultConfig, ...loaded }
  return cachedConfig
}

export async function loadBumpConfig(overrides?: Partial<BumpxConfig>): Promise<BumpxConfig> {
  const base = await getConfig()
  return { ...defaultConfig, ...base, ...overrides }
}

/**
 * Define configuration helper for TypeScript config files
 */
export function defineConfig(config: VersionBumpOptions): VersionBumpOptions {
  return config
}
