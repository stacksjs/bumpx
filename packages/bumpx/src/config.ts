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
}

/**
 * Load bumpx configuration with overrides
 */
let _config: BumpxConfig | undefined

export async function getConfig(): Promise<BumpxConfig> {
  if (!_config)
    _config = await loadBumpConfig()
  return _config
}

// Legacy export for backward compatibility
export const config: BumpxConfig = defaultConfig

/**
 * Load bumpx configuration with overrides
 */
export async function loadBumpConfig(overrides?: Partial<BumpxConfig>): Promise<BumpxConfig> {
  // 1) Load from bumpx.config.* via bunfig
  const fileConfig = await loadConfig({
    name: 'bumpx',
    defaultConfig,
  })

  // 2) Load from package.json "bumpx" key (if present)
  let packageConfig: Partial<BumpxConfig> = {}
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const pkgPath = path.join(process.cwd(), 'package.json')
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, 'utf-8')
      const pkg = JSON.parse(raw)
      if (pkg && typeof pkg.bumpx === 'object' && pkg.bumpx !== null)
        packageConfig = pkg.bumpx as Partial<BumpxConfig>
    }
  }
  catch {
    // Silently ignore package.json read/parse errors here; they are handled elsewhere during actual bump
  }

  // 3) Merge with precedence: default < fileConfig < package.json < overrides
  return { ...defaultConfig, ...fileConfig, ...packageConfig, ...overrides }
}

/**
 * Define configuration helper for TypeScript config files
 */
export function defineConfig(config: VersionBumpOptions): VersionBumpOptions {
  return config
}
