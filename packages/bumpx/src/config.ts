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
    defaultConfig: bumpConfigDefaults,
  })

  // Only keep the properties we expect
  const config: BumpxConfig = {
    commit: loadedConfig.commit ?? bumpConfigDefaults.commit,
    tag: loadedConfig.tag ?? bumpConfigDefaults.tag,
    push: loadedConfig.push ?? bumpConfigDefaults.push,
    sign: loadedConfig.sign ?? bumpConfigDefaults.sign,
    noGitCheck: loadedConfig.noGitCheck ?? bumpConfigDefaults.noGitCheck,
    noVerify: loadedConfig.noVerify ?? bumpConfigDefaults.noVerify,
    install: loadedConfig.install ?? bumpConfigDefaults.install,
    ignoreScripts: loadedConfig.ignoreScripts ?? bumpConfigDefaults.ignoreScripts,
    confirm: loadedConfig.confirm ?? bumpConfigDefaults.confirm,
    quiet: loadedConfig.quiet ?? bumpConfigDefaults.quiet,
    ci: loadedConfig.ci ?? bumpConfigDefaults.ci,
    all: loadedConfig.all ?? bumpConfigDefaults.all,
    recursive: loadedConfig.recursive ?? bumpConfigDefaults.recursive,
    printCommits: loadedConfig.printCommits ?? bumpConfigDefaults.printCommits,
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
