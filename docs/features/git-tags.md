# Git Tags

Bumpx provides seamless Git integration for creating commits, tags, and pushing changes as part of the version bumping process.

## Basic Git Operations

### Creating Commits

Automatically commit version changes:

```bash
# Bump and commit
bumpx patch --commit

# Custom commit message
bumpx patch --commit --commit-message "chore: release v%s"

# The %s placeholder is replaced with the new version
# Result: "chore: release v1.2.3"
```

### Creating Tags

Create Git tags for releases:

```bash
# Create annotated tag
bumpx patch --tag

# Custom tag message
bumpx patch --tag --tag-message "Release v%s"

# Custom tag name pattern
bumpx patch --tag --tag-name "v%s"
```

### Pushing Changes

Push commits and tags to remote:

```bash
# Push after bump
bumpx patch --push

# Push to specific remote
bumpx patch --push --remote origin

# Push only tags
bumpx patch --tag --push
```

## Combined Git Workflow

### Full Release Workflow

Combine all Git operations for a complete release:

```bash
# Complete release workflow
bumpx patch --commit --tag --push

# With custom messages
bumpx minor --commit --tag --push \
  --commit-message "chore(release): v%s" \
  --tag-message "Release %s"

# With build step
bumpx major --commit --tag --push --execute "bun run build"
```

### Staged Workflow

Control the workflow step by step:

```bash
# Bump and commit, but don't tag or push yet
bumpx patch --commit

# Review changes
git log --oneline -1
git diff HEAD~1

# Manually tag when ready
git tag -a v1.2.3 -m "Release v1.2.3"

# Push when verified
git push origin main --tags
```

## Signing Commits and Tags

### GPG Signing

Sign commits and tags for security:

```bash
# Sign commit and tag
bumpx patch --commit --tag --sign

# Requires GPG key configured in Git:
# git config --global user.signingkey YOUR_KEY_ID
# git config --global commit.gpgsign true
```

### SSH Signing

Use SSH keys for signing (Git 2.34+):

```bash
# Configure SSH signing in Git
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# Sign with bumpx
bumpx patch --commit --tag --sign
```

## Git Hook Integration

### Pre-commit Hooks

Skip hooks when needed:

```bash
# Skip pre-commit hooks
bumpx patch --commit --no-verify

# Useful when hooks might fail during version bump
bumpx patch --commit --tag --no-verify
```

### Post-commit Hooks

Hooks run automatically after bumpx commits:

```bash
# .git/hooks/post-commit
#!/bin/sh
echo "Version bumped: $(git describe --tags --abbrev=0)"
```

## Branch Protection

### Working with Protected Branches

Handle protected branches:

```bash
# Create release on separate branch
git checkout -b release/v1.2.3
bumpx patch --commit --tag
git checkout main
git merge release/v1.2.3
git push origin main --tags

# Or use PR workflow
bumpx patch --commit  # Don't push directly
# Create PR and merge
```

### Skip Git Status Check

Bypass dirty working directory check:

```bash
# Skip git status check (use with caution)
bumpx patch --no-git-check

# Useful for CI environments with modified files
bumpx patch --ci --no-git-check
```

## Tag Management

### Tag Naming Conventions

Common tag naming patterns:

```bash
# Semantic version tag (default)
bumpx patch --tag  # Creates: v1.2.3

# Without v prefix
bumpx patch --tag --tag-name "%s"  # Creates: 1.2.3

# Custom prefix
bumpx patch --tag --tag-name "release-%s"  # Creates: release-1.2.3

# Package-specific tags (monorepo)
bumpx patch --tag --tag-name "@myorg/package@%s"
```

### Annotated vs Lightweight Tags

Bumpx creates annotated tags by default:

```bash
# Annotated tag (default)
bumpx patch --tag
# git tag -a v1.2.3 -m "v1.2.3"

# View tag details
git show v1.2.3
```

### Listing and Verifying Tags

Work with existing tags:

```bash
# List version tags
git tag -l "v*"

# Verify signed tag
git tag -v v1.2.3

# Show tag message
git tag -n1 v1.2.3
```

## CI/CD Git Integration

### GitHub Actions

Automated tagging in CI:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version type'
        required: true
        default: 'patch'
        type: choice
        options: [patch, minor, major]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Version Bump
        run: |
          bun add -g @stacksjs/bumpx
          bumpx ${{ github.event.inputs.version }} --commit --tag --push
```

### GitLab CI

```yaml
release:
  stage: release
  script:
    - git config user.name "GitLab CI"
    - git config user.email "ci@gitlab.com"
    - bumpx patch --commit --tag
    - git push origin HEAD:$CI_COMMIT_REF_NAME --tags
  only:
    - main
```

## Commit Message Formatting

### Conventional Commits

Follow conventional commit standards:

```bash
# Feature release
bumpx minor --commit --commit-message "feat: release v%s"

# Bug fix release
bumpx patch --commit --commit-message "fix: release v%s"

# Breaking change
bumpx major --commit --commit-message "feat!: release v%s

BREAKING CHANGE: API changes in this release"
```

### Custom Message Templates

Use message templates:

```ts
// bumpx.config.ts
export default defineConfig({
  commit: true,
  tag: true,
  commitMessage: 'chore(release): %s [skip ci]',
  tagMessage: 'Release %s\n\nChanges in this release:\n- See CHANGELOG.md',
})
```

## Rollback and Recovery

### Undoing a Release

Revert version bump if needed:

```bash
# Undo last commit (keeps changes staged)
git reset --soft HEAD~1

# Undo commit and changes
git reset --hard HEAD~1

# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push origin :refs/tags/v1.2.3
```

### Recovery from Failed Push

Handle push failures:

```bash
# If push failed after commit and tag
git push origin main
git push origin v1.2.3

# Or push everything
git push origin main --tags

# If remote has conflicts
git pull --rebase origin main
git push origin main --tags
```

## Configuration

### Git Configuration in bumpx.config.ts

```ts
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig({
  // Commit settings
  commit: true,
  commitMessage: 'chore(release): v%s',

  // Tag settings
  tag: true,
  tagMessage: 'Release v%s',
  tagName: 'v%s',

  // Push settings
  push: true,
  remote: 'origin',

  // Signing
  sign: false,

  // Hooks
  noVerify: false,
})
```

## Best Practices

1. **Use Conventional Commits**: Follow a consistent commit message format
2. **Sign Releases**: Use GPG/SSH signing for important releases
3. **Annotated Tags**: Always use annotated tags with meaningful messages
4. **CI Integration**: Automate releases through CI/CD pipelines
5. **Branch Protection**: Use PRs for version bumps on protected branches
6. **Tag Naming**: Use consistent tag naming (v1.2.3 or 1.2.3)
7. **Push Together**: Push commits and tags together to avoid inconsistencies
8. **Skip CI**: Add [skip ci] to commit messages when appropriate
