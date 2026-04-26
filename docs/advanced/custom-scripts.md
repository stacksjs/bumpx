# Custom Scripts

Bumpx supports executing custom scripts and commands as part of the version bumping workflow. This enables integration with build tools, testing frameworks, and deployment pipelines.

## Execute Option

### Basic Execution

Run commands before git operations:

```bash
# Single command
bumpx patch --execute "bun run build"

# Multiple commands
bumpx minor --execute "bun run test && bun run build"

# With quotes for complex commands
bumpx major --execute "npm run lint -- --fix"
```

### Configuration-Based Execution

Define commands in configuration:

```ts
// bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig({
  commit: true,
  tag: true,

  // Single command
  execute: 'bun run build',

  // Or multiple commands
  execute: [
    'bun run lint',
    'bun run test',
    'bun run build',
  ],
})
```

## Execution Timing

### Before Git Operations

Commands execute before commit/tag:

```
1. Version bump in files
2. Execute commands <-- here
3. Git add (if --all)
4. Git commit
5. Git tag
6. Git push
```

This ensures built artifacts are included in the commit.

### Example Workflow

```bash
# 1. Version in package.json: 1.0.0 -> 1.1.0
# 2. Execute: bun run build (updates dist/)
# 3. Git add package.json dist/
# 4. Git commit -m "chore: release v1.1.0"
# 5. Git tag v1.1.0
```

## Common Script Patterns

### Build and Test

```ts
export default defineConfig({
  execute: [
    'bun run typecheck',
    'bun run lint',
    'bun run test',
    'bun run build',
  ],
})
```

### Documentation Generation

```ts
export default defineConfig({
  execute: [
    'bun run build',
    'bun run docs:build',
    'bun run changelog',
  ],
})
```

### Monorepo Build

```ts
export default defineConfig({
  execute: [
    'bun run build:packages',
    'bun run build:cli',
    'bun run test:all',
  ],
})
```

### Release Preparation

```ts
export default defineConfig({
  execute: [
    // Update changelog
    'npx conventional-changelog -p angular -i CHANGELOG.md -s',
    // Build
    'bun run build',
    // Verify bundle
    'bun run size-limit',
  ],
})
```

## Script Variables

### Version Placeholder

Use `%s` for the new version:

```bash
# Access new version in scripts
bumpx patch --execute "echo 'Releasing version %s'"
```

### Environment Variables

Scripts have access to environment:

```bash
# Environment variables are available
bumpx patch --execute "echo $NODE_ENV"

# Set variables for script
NODE_ENV=production bumpx patch --execute "bun run build"
```

### Package.json Scripts

Call package.json scripts:

```json
{
  "scripts": {
    "prebump": "bun run test",
    "build": "tsup",
    "postbump": "bun run deploy"
  }
}
```

```bash
bumpx patch --execute "npm run prebump && npm run build"
```

## Error Handling

### Script Failure Behavior

If a script fails, bumpx stops:

```bash
# If test fails, no commit/tag created
bumpx patch --execute "bun run test"
# Exit code: 1 (from test failure)
```

### Conditional Execution

```bash
# Continue on lint warning (|| true)
bumpx patch --execute "bun run lint || true"

# Fail on any error
bumpx patch --execute "set -e && bun run lint && bun run test"
```

### Error Recovery

```ts
// bumpx.config.ts
export default defineConfig({
  execute: [
    // Try to run, continue if fails
    'bun run optional-script || echo "Skipped"',
    // Required step
    'bun run build',
  ],
})
```

## Pre and Post Hooks

### npm/Bun Lifecycle Scripts

```json
{
  "scripts": {
    "preversion": "bun run test",
    "version": "bun run build",
    "postversion": "git push --follow-tags"
  }
}
```

### Custom Hook Pattern

```ts
// scripts/bump-hooks.ts
export async function preVersion(currentVersion: string) {
  console.log(`Preparing to bump from ${currentVersion}`)
  // Run tests, checks, etc.
}

export async function postVersion(newVersion: string) {
  console.log(`Successfully bumped to ${newVersion}`)
  // Notify, deploy, etc.
}
```

```bash
bumpx patch --execute "bun run scripts/bump-hooks.ts"
```

## Advanced Script Patterns

### Dynamic Script Generation

```ts
// bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'

const isMonorepo = process.env.MONOREPO === 'true'

export default defineConfig({
  execute: isMonorepo
    ? [
        'bun run build:core',
        'bun run build:packages',
        'bun run test:integration',
      ]
    : [
        'bun run build',
        'bun run test',
      ],
})
```

### Async Script Execution

```ts
// scripts/prepare-release.ts
import { $ } from 'bun'

async function prepareRelease() {
  // Run tests in parallel
  await Promise.all([
    $`bun run test:unit`,
    $`bun run test:e2e`,
  ])

  // Build sequentially
  await $`bun run build`
  await $`bun run docs:build`
}

prepareRelease()
```

```bash
bumpx patch --execute "bun run scripts/prepare-release.ts"
```

### Notification Scripts

```ts
// scripts/notify-release.ts
import { version } from '../package.json'

async function notifyRelease() {
  // Slack notification
  await fetch(process.env.SLACK_WEBHOOK!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Released version ${version}`,
    }),
  })

  // Discord notification
  await fetch(process.env.DISCORD_WEBHOOK!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `New release: v${version}`,
    }),
  })
}

notifyRelease()
```

## Package.json Integration

### Release Scripts

```json
{
  "scripts": {
    "release": "bumpx prompt --execute 'bun run build' --commit --tag --push",
    "release:patch": "bumpx patch --execute 'bun run build' --commit --tag --push",
    "release:minor": "bumpx minor --execute 'bun run build' --commit --tag --push",
    "release:major": "bumpx major --execute 'bun run build' --commit --tag --push",
    "release:prerelease": "bumpx prerelease --preid beta --execute 'bun run build' --commit --tag",
    "release:dry": "bumpx patch --execute 'bun run build' --dry-run"
  }
}
```

### Complex Release Pipeline

```json
{
  "scripts": {
    "prerelease": "bun run lint && bun run test",
    "release:prepare": "bun run changelog && bun run build",
    "release:publish": "npm publish",
    "release": "bumpx minor --execute 'npm run prerelease && npm run release:prepare' --commit --tag --push && npm run release:publish"
  }
}
```

## CI/CD Scripts

### GitHub Actions Script

```yaml
- name: Release
  run: |
    bumpx ${{ inputs.version_type }} \
      --execute "bun run build && bun run test" \
      --commit \
      --tag \
      --push \
      --ci
```

### Script with Secrets

```ts
// scripts/release.ts
const NPM_TOKEN = process.env.NPM_TOKEN

if (!NPM_TOKEN) {
  throw new Error('NPM_TOKEN required for release')
}

// Configure npm
await Bun.write('.npmrc', `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`)

// Build
await $`bun run build`

// Publish
await $`npm publish`
```

## Best Practices

1. **Test Scripts First**: Run scripts manually before using with bumpx
2. **Use Exit Codes**: Ensure scripts return proper exit codes
3. **Keep Scripts Simple**: Complex logic should be in separate script files
4. **Log Progress**: Include logging in long-running scripts
5. **Handle Errors**: Implement proper error handling in scripts
6. **Timeout Consideration**: Be aware of long-running script timeouts
7. **Idempotent Scripts**: Scripts should be safe to run multiple times
8. **Environment Isolation**: Don't rely on global state in scripts
