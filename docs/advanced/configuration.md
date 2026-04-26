# Advanced Configuration

Bumpx offers extensive configuration options for customizing version bumping behavior, git integration, and workflow automation. This guide covers advanced configuration patterns.

## Configuration File

### bumpx.config.ts

Create a `bumpx.config.ts` file in your project root:

```ts
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig({
  // Version bumping
  files: ['package.json'],
  recursive: false,

  // Git operations
  commit: true,
  tag: true,
  push: false,
  sign: false,

  // Messages
  commitMessage: 'chore(release): v%s',
  tagMessage: 'v%s',
  tagName: 'v%s',

  // Execution
  execute: [],
  install: false,

  // UI options
  confirm: true,
  quiet: false,

  // Advanced
  all: false,
  noVerify: false,
  ignoreScripts: false,
  printCommits: false,
})
```

### Package.json Configuration

Configure in package.json:

```json
{
  "bumpx": {
    "commit": true,
    "tag": true,
    "push": true,
    "commitMessage": "chore: release v%s",
    "execute": "bun run build"
  }
}
```

## Environment-Specific Configuration

### Development vs Production

```ts
// bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'

const isDev = process.env.NODE_ENV === 'development'
const isCI = process.env.CI === 'true'

export default defineConfig({
  // Skip confirmation in CI
  confirm: !isCI,

  // Quiet mode in CI
  quiet: isCI,

  // Only push in CI
  push: isCI,

  // Verbose in development
  verbose: isDev,

  // Git operations
  commit: true,
  tag: true,
})
```

### Multi-Environment Configs

```ts
// config/bumpx.dev.ts
export default defineConfig({
  commit: false,
  tag: false,
  push: false,
  confirm: true,
})

// config/bumpx.prod.ts
export default defineConfig({
  commit: true,
  tag: true,
  push: true,
  confirm: false,
  execute: ['bun run build', 'bun run test'],
})
```

## Configuration Options Reference

### Version Options

```ts
interface VersionOptions {
  // Files to update
  files?: string[]

  // Recursively find package.json files
  recursive?: boolean

  // Current version override
  currentVersion?: string

  // Prerelease identifier
  preid?: string

  // Include all files in commit
  all?: boolean
}
```

### Git Options

```ts
interface GitOptions {
  // Create commit
  commit?: boolean | string

  // Commit message template (%s = version)
  commitMessage?: string

  // Create tag
  tag?: boolean | string

  // Tag message template
  tagMessage?: string

  // Tag name template
  tagName?: string

  // Push to remote
  push?: boolean

  // Remote name
  remote?: string

  // Sign commits and tags
  sign?: boolean

  // Skip git hooks
  noVerify?: boolean

  // Skip git status check
  noGitCheck?: boolean
}
```

### Execution Options

```ts
interface ExecutionOptions {
  // Commands to execute
  execute?: string | string[]

  // Run npm/bun install
  install?: boolean

  // Ignore npm scripts
  ignoreScripts?: boolean
}
```

### UI Options

```ts
interface UIOptions {
  // Show confirmation prompt
  confirm?: boolean

  // Quiet mode (minimal output)
  quiet?: boolean

  // Verbose output
  verbose?: boolean

  // CI mode (implies --yes --quiet)
  ci?: boolean

  // Print recent commits
  printCommits?: boolean
}
```

## Dynamic Configuration

### Computed Configuration Values

```ts
// bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const isMonorepo = pkg.workspaces !== undefined

export default defineConfig({
  recursive: isMonorepo,

  commitMessage: isMonorepo
    ? 'chore: release packages v%s'
    : 'chore: release v%s',

  execute: isMonorepo
    ? ['bun run build:all']
    : ['bun run build'],
})
```

### Async Configuration

```ts
// bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig(async () => {
  // Fetch configuration from remote
  const remoteConfig = await fetch('https://config.example.com/bumpx')
    .then(r => r.json())
    .catch(() => ({}))

  return {
    commit: true,
    tag: true,
    ...remoteConfig,
  }
})
```

## Configuration Presets

### Create Reusable Presets

```ts
// presets/release.ts
import { defineConfig } from '@stacksjs/bumpx'

export const releasePreset = defineConfig({
  commit: true,
  tag: true,
  push: true,
  sign: true,
  execute: ['bun run build', 'bun run test'],
  commitMessage: 'chore(release): v%s',
})

export const devPreset = defineConfig({
  commit: false,
  tag: false,
  push: false,
  confirm: true,
})

export const ciPreset = defineConfig({
  commit: true,
  tag: true,
  push: true,
  confirm: false,
  quiet: true,
  ci: true,
})
```

### Using Presets

```ts
// bumpx.config.ts
import { releasePreset } from './presets/release'

export default {
  ...releasePreset,
  // Override specific options
  sign: false,
}
```

## Configuration Validation

### Validate Configuration

```ts
import type { BumpxConfig } from '@stacksjs/bumpx'

function validateConfig(config: BumpxConfig): void {
  if (config.push && !config.commit) {
    throw new Error('Cannot push without committing')
  }

  if (config.sign && !config.commit && !config.tag) {
    throw new Error('Signing requires commit or tag to be enabled')
  }

  if (config.commitMessage && !config.commitMessage.includes('%s')) {
    console.warn('Commit message should include %s placeholder for version')
  }
}
```

## Monorepo Configuration

### Workspace Configuration

```ts
// bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig({
  recursive: true,

  // Synchronized versioning
  currentVersion: '1.0.0',

  // Or specify files explicitly
  files: [
    'package.json',
    'packages/core/package.json',
    'packages/cli/package.json',
    'packages/utils/package.json',
  ],

  commit: true,
  commitMessage: 'chore: release all packages v%s',
  tag: true,
  tagName: 'v%s',
})
```

### Per-Package Configuration

```ts
// packages/core/bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig({
  recursive: false,
  tagName: '@myorg/core@%s',
  commitMessage: 'chore(core): release v%s',
})
```

## Execute Command Patterns

### Multiple Commands

```ts
export default defineConfig({
  execute: [
    'bun run lint',
    'bun run test',
    'bun run build',
    'bun run docs:build',
  ],
})
```

### Conditional Execution

```ts
export default defineConfig({
  execute: process.env.SKIP_TESTS
    ? ['bun run build']
    : ['bun run test', 'bun run build'],
})
```

### Shell Commands

```bash
# Using shell operators
bumpx patch --execute "bun run test && bun run build"

# With error handling
bumpx patch --execute "bun run test || exit 1"
```

## CLI Override Priority

Configuration priority (highest to lowest):

1. CLI arguments
2. Environment variables
3. Configuration file (bumpx.config.ts)
4. Package.json bumpx field
5. Default values

```bash
# CLI overrides config file
bumpx patch --no-commit  # Overrides commit: true in config
```

## Best Practices

1. **Use defineConfig**: Leverage TypeScript for configuration validation
2. **Separate Environments**: Use different configs for dev/prod/CI
3. **Validate Early**: Validate configuration before running
4. **Document Config**: Comment configuration options for team members
5. **Version Control**: Keep configuration in version control
6. **Presets for Teams**: Create shared presets for consistent releases
7. **Minimal Defaults**: Start with minimal config and add as needed
8. **Test Configuration**: Verify config changes with dry-run first
