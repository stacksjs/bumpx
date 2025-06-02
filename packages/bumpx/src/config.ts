import type { BumpxConfig } from './types'
import { loadConfig } from 'bunfig'

export const defaultConfig: BumpxConfig = {
  verbose: false,
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: BumpxConfig = await loadConfig({
  name: 'bumpx',
  defaultConfig,
})
