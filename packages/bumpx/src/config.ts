import type { BumpxConfig, VersionBumpOptions } from './types'
// @ts-expect-error - bunfig types have an issue atm but functionality works properly
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
export async function loadBumpConfig(overrides: Partial<VersionBumpOptions> = {}): Promise<VersionBumpOptions> {
  const loadedConfig = await loadConfig({
    name: 'bumpx',
    defaultConfig,
  })

  // Only keep the properties we expect
  const config: BumpxConfig = {
    commit: loadedConfig.commit ?? defaultConfig.commit,
    tag: loadedConfig.tag ?? defaultConfig.tag,
    push: loadedConfig.push ?? defaultConfig.push,
    sign: loadedConfig.sign ?? defaultConfig.sign,
    noGitCheck: loadedConfig.noGitCheck ?? defaultConfig.noGitCheck,
    noVerify: loadedConfig.noVerify ?? defaultConfig.noVerify,
    install: loadedConfig.install ?? defaultConfig.install,
    ignoreScripts: loadedConfig.ignoreScripts ?? defaultConfig.ignoreScripts,
    confirm: loadedConfig.confirm ?? defaultConfig.confirm,
    quiet: loadedConfig.quiet ?? defaultConfig.quiet,
    ci: loadedConfig.ci ?? defaultConfig.ci,
    all: loadedConfig.all ?? defaultConfig.all,
    recursive: loadedConfig.recursive ?? defaultConfig.recursive,
    printCommits: loadedConfig.printCommits ?? defaultConfig.printCommits,
  }

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
