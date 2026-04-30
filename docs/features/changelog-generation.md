# Changelog Generation

Bumpx can integrate with changelog generation tools and workflows to automatically document your releases. This guide covers changelog integration patterns and best practices.

## Viewing Recent Commits

### Print Commits Before Bump

Review changes before selecting a version:

```bash
# Show recent commits
bumpx prompt --print-commits

# Interactive mode with commit context
bumpx prompt --commits
```

This helps you decide which version bump is appropriate:

- Bug fixes and patches -> `patch`
- New features -> `minor`
- Breaking changes -> `major`

## Changelog Integration

### Execute Changelog Generation

Run changelog tools as part of the bump process:

```bash
# Generate changelog before committing
bumpx minor --execute "bun run changelog" --commit --tag

# Multiple commands
bumpx patch --execute "bun run changelog && bun run build" --commit --tag

# Using conventional-changelog-cli
bumpx minor --execute "npx conventional-changelog -p angular -i CHANGELOG.md -s" --commit --tag
```

### Staged Changelog Workflow

Generate changelog in stages:

```bash
# 1. Generate changelog first
npx conventional-changelog -p angular -i CHANGELOG.md -s

# 2. Review and edit CHANGELOG.md manually if needed

# 3. Bump version with all changes
bumpx minor --all --commit --tag --push
```

## Changelog Tools Integration

### conventional-changelog

Integrate with conventional-changelog:

```ts
// bumpx.config.ts
export default defineConfig({
  commit: true,
  tag: true,
  push: true,
  execute: 'npx conventional-changelog -p angular -i CHANGELOG.md -s',
})
```

```bash
# Install conventional-changelog
bun add -D conventional-changelog-cli

# Usage
bumpx minor  # Automatically generates changelog
```

### changelogen

Use changelogen for modern changelog generation:

```ts
// bumpx.config.ts
export default defineConfig({
  commit: true,
  tag: true,
  execute: 'bunx changelogen --output CHANGELOG.md',
})
```

```bash
# Install changelogen
bun add -D changelogen

# Usage
bumpx patch
```

### release-it

Integrate with release-it:

```json
{
  "scripts": {
    "release": "release-it"
  }
}
```

```js
// .release-it.json
{
  "git": {
    "commitMessage": "chore: release v${version}"
  },
  "github": {
    "release": true
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "angular",
      "infile": "CHANGELOG.md"
    }
  }
}
```

## Manual Changelog Management

### CHANGELOG.md Structure

Standard changelog format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- New feature X

### Changed

- Modified behavior Y

### Fixed

- Bug fix Z

## [1.2.0] - 2024-01-15

### Added

- Feature A
- Feature B

### Changed

- Updated dependency X

## [1.1.0] - 2024-01-01

### Added

- Initial release features

```

### Automating Changelog Updates

Script to update changelog:

```ts
// scripts/update-changelog.ts
import { readFile, writeFile } from 'node:fs/promises'

async function updateChangelog(version: string) {
  const changelog = await readFile('CHANGELOG.md', 'utf-8')
  const date = new Date().toISOString().split('T')[0]

  // Move unreleased to versioned section
  const updated = changelog.replace(
    '## [Unreleased]',
    `## [Unreleased]\n\n## [${version}] - ${date}`,
  )

  await writeFile('CHANGELOG.md', updated)
  console.log(`Updated CHANGELOG.md for v${version}`)
}

// Get version from package.json
const pkg = await Bun.file('package.json').json()
await updateChangelog(pkg.version)
```

```bash
# Use in bumpx workflow
bumpx minor --execute "bun run scripts/update-changelog.ts" --commit --tag
```

## Git-Based Changelog

### Generating from Git History

Create changelog from git commits:

```ts
// scripts/generate-changelog.ts
import { $ } from 'bun'

async function generateChangelog(fromTag: string, toTag: string = 'HEAD') {
  const commits = await $`git log ${fromTag}..${toTag} --pretty=format:"%s (%h)" --no-merges`.text()

  const sections = {
    feat: [] as string[],
    fix: [] as string[],
    docs: [] as string[],
    chore: [] as string[],
    other: [] as string[],
  }

  for (const commit of commits.split('\n')) {
    if (commit.startsWith('feat')) sections.feat.push(commit)
    else if (commit.startsWith('fix')) sections.fix.push(commit)
    else if (commit.startsWith('docs')) sections.docs.push(commit)
    else if (commit.startsWith('chore')) sections.chore.push(commit)
    else sections.other.push(commit)
  }

  let changelog = `## Changes since ${fromTag}\n\n`

  if (sections.feat.length) {
    changelog += `### Features\n${sections.feat.map(c => `- ${c}`).join('\n')}\n\n`
  }
  if (sections.fix.length) {
    changelog += `### Bug Fixes\n${sections.fix.map(c => `- ${c}`).join('\n')}\n\n`
  }
  if (sections.docs.length) {
    changelog += `### Documentation\n${sections.docs.map(c => `- ${c}`).join('\n')}\n\n`
  }

  return changelog
}

const latestTag = (await $`git describe --tags --abbrev=0`.text()).trim()
const changelog = await generateChangelog(latestTag)
console.log(changelog)
```

### Commit Convention for Changelogs

Follow conventional commits for automatic categorization:

```bash
# Features
git commit -m "feat: add new API endpoint"
git commit -m "feat(auth): implement OAuth2 support"

# Bug fixes
git commit -m "fix: resolve memory leak in parser"
git commit -m "fix(ui): correct button alignment"

# Breaking changes
git commit -m "feat!: change API response format"
git commit -m "feat(api)!: remove deprecated endpoints

BREAKING CHANGE: The /v1/users endpoint has been removed."

# Documentation
git commit -m "docs: update installation guide"

# Chores
git commit -m "chore: update dependencies"
git commit -m "chore(release): v1.2.3"
```

## GitHub Releases

### Creating GitHub Releases

Integrate with GitHub releases:

```bash
# Bump, tag, and create GitHub release
bumpx minor --commit --tag --push \
  --execute "gh release create v$(jq -r .version package.json) --generate-notes"
```

### GitHub Actions Release Workflow

```yaml
name: Release

on:
  push:
    tags:

      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:

      - uses: actions/checkout@v4

        with:
          fetch-depth: 0

      - name: Generate changelog

        id: changelog
        run: |
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "")
          if [ -n "$PREV_TAG" ]; then
            CHANGES=$(git log $PREV_TAG..HEAD --pretty=format:"- %s" --no-merges)
          else
            CHANGES=$(git log --pretty=format:"- %s" --no-merges)
          fi
          echo "changes<<EOF" >> $GITHUB_OUTPUT
          echo "$CHANGES" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create Release

        uses: softprops/action-gh-release@v1
        with:
          body: |
## What's Changed
            ${{ steps.changelog.outputs.changes }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Configuration

### Changelog Configuration

```ts
// bumpx.config.ts
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig({
  commit: true,
  tag: true,
  push: true,

  // Run changelog generation before commit
  execute: [
    'bunx changelogen --output CHANGELOG.md',
    'bun run build',
  ],

  // Commit message includes changelog
  commitMessage: 'chore(release): v%s\n\nSee CHANGELOG.md for details',
})
```

### Package.json Scripts

```json
{
  "scripts": {
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",
    "release:patch": "bumpx patch --execute 'bun run changelog' --commit --tag --push",
    "release:minor": "bumpx minor --execute 'bun run changelog' --commit --tag --push",
    "release:major": "bumpx major --execute 'bun run changelog' --commit --tag --push"
  }
}
```

## Best Practices

1. **Use Conventional Commits**: Follow a commit convention for automatic changelog generation
2. **Keep Unreleased Section**: Maintain an "Unreleased" section in CHANGELOG.md
3. **Link to Commits**: Include commit hashes or links in changelog entries
4. **Categorize Changes**: Group changes by type (Added, Changed, Fixed, etc.)
5. **Include Breaking Changes**: Clearly mark and explain breaking changes
6. **Date Your Releases**: Include release dates in the changelog
7. **Review Before Release**: Always review auto-generated changelogs before publishing
8. **Link to Issues/PRs**: Reference related issues and pull requests
