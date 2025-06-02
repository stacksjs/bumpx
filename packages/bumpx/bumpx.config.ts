import type { VersionBumpOptions } from './src/types'
import { defineConfig } from './src/config'

const config: VersionBumpOptions = defineConfig({
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

  // Example execute commands
  // execute: ['bun run build', 'bun run test'],

  // Example custom commit message
  // commit: 'chore: release v{version}',

  // Example custom tag format
  // tag: 'v{version}',

  // Example preid for prereleases
  // preid: 'beta'
})

export default config
