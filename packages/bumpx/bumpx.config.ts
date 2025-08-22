import type { VersionBumpOptions } from './src/types'
import { defineConfig } from './src/config'

const config: VersionBumpOptions = defineConfig({
  // Git options (these match the new defaults)
  commit: true,
  tag: true,
  push: false,
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
  recursive: true, // Updated to match new default
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
