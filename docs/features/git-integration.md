# Git Integration

bumpx provides seamless integration with Git workflows, automating commits, tags, and pushes as part of your version bumping process.

## Automatic Git Operations

### Basic Git Workflow

Automate your entire release workflow:

```bash
# Create commit for version bump
bumpx patch --commit

# Create commit and tag
bumpx minor --commit --tag

# Full workflow: commit, tag, and push
bumpx major --commit --tag --push
```

### Git Status Checking

bumpx checks your working directory state before making changes:

```bash
# Requires clean working directory
bumpx patch --commit

# Skip git status check (allows dirty working directory)
bumpx patch --commit --no-git-check

# Check what files are staged/modified
git status
```

## Commit Management

### Automatic Commits

Create descriptive commits automatically:

```bash
# Default commit message: "chore: bump version to 1.2.3"
bumpx patch --commit

# Custom commit message
bumpx minor --commit --message "release: v%s"

# Include additional context
bumpx patch --commit --message "fix: patch release %s - security updates"
```

### Commit Message Templates

Use placeholders in your commit messages:

```bash
# %s is replaced with the new version
bumpx patch --commit --message "chore: release v%s"

# Custom format options
bumpx minor --commit --message "🚀 Release %s"
bumpx major --commit --message "BREAKING: Version %s released"
```

### Signed Commits

Sign your releases with GPG:

```bash
# Create signed commit
bumpx patch --commit --sign

# Sign both commit and tag
bumpx minor --commit --tag --sign
```

Setup GPG signing:

```bash
# Configure Git to use your signing key
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true

# Verify GPG setup
gpg --list-secret-keys --keyid-format LONG
```

## Tag Management

### Automatic Tagging

Create version tags automatically:

```bash
# Create lightweight tag
bumpx patch --tag

# Create annotated tag with message
bumpx minor --tag --tag-message "Release v%s"

# Signed tags for security
bumpx major --tag --sign
```

### Tag Naming Conventions

Customize tag formats:

```bash
# Default: "v1.2.3"
bumpx patch --tag

# Custom format: "release-1.2.3"
bumpx patch --tag --tag-message "release-%s"

# Semantic format: "v1.2.3 - Bug fixes"
bumpx patch --tag --tag-message "v%s - Bug fixes and improvements"
```

### Tag Management

List and manage existing tags:

```bash
# List all tags
git tag -l

# List tags matching pattern
git tag -l "v1.*"

# Delete tag (if needed)
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

## Remote Repository Integration

### Push Operations

Automatically push changes to remote:

```bash
# Push commits and tags
bumpx patch --commit --tag --push

# Push to specific remote
git remote add origin https://github.com/user/repo.git
bumpx patch --commit --tag --push
```

### Branch Management

Handle different branch scenarios:

```bash
# Check current branch
git branch --show-current

# Ensure you're on the right branch
git checkout main
bumpx patch --commit --tag --push

# Release from feature branch
git checkout feature/release-prep
bumpx patch --commit --tag
git checkout main
git merge feature/release-prep
git push origin main --tags
```

## Git Hooks Integration

### Pre-commit Hooks

Validate versions before committing:

```bash
#!/bin/sh
# .git/hooks/pre-commit
echo "Validating version consistency..."
bumpx --dry-run --verbose
if [ $? -ne 0 ]; then
    echo "Version validation failed!"
    exit 1
fi
```

### Post-commit Hooks

Automate post-release tasks:

```bash
#!/bin/sh
# .git/hooks/post-commit
# Check if this was a version bump commit
if git log -1 --pretty=%B | grep -q "bump version to"; then
    echo "Version bump detected, running build..."
    npm run build
fi
```

### Skip Git Hooks

Bypass hooks when needed:

```bash
# Skip all git hooks
bumpx patch --commit --no-verify

# Useful for CI/CD environments
bumpx patch --commit --tag --push --no-verify
```

## Advanced Git Features

### Multiple Remotes

Handle projects with multiple remotes:

```bash
# List remotes
git remote -v

# Push to specific remote
git push upstream main --tags

# Configure default push behavior
git config push.default current
```

### Conflict Resolution

Handle merge conflicts during automated releases:

```bash
# If conflicts occur during automated push
git status
git add .
git commit --no-edit
git push origin main --tags
```

### Rebase Integration

Use with rebase workflows:

```bash
# Interactive rebase before release
git rebase -i HEAD~5
bumpx patch --commit --tag

# Squash commits then bump version
git rebase -i --autosquash HEAD~3
bumpx minor --commit --tag --push
```

## CI/CD Integration

### GitHub Actions

Automate releases in GitHub Actions:

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Bump version and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          bumpx patch --commit --tag --push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

Integration with GitLab pipelines:

```yaml
release:
  stage: release
  script:
    - git config user.name "GitLab CI"
    - git config user.email "ci@gitlab.com"
    - bumpx patch --commit --tag --push
  only:
    - main
```

### Authentication

Setup authentication for automated releases:

```bash
# GitHub (use personal access token)
git remote set-url origin https://token:$GITHUB_TOKEN@github.com/user/repo.git

# GitLab (use deploy token)
git remote set-url origin https://gitlab-ci-token:$CI_JOB_TOKEN@gitlab.com/user/repo.git

# SSH keys (recommended for security)
ssh-keygen -t ed25519 -C "ci@example.com"
# Add public key to GitHub/GitLab
```

## Git Configuration

### Repository Setup

Essential Git configuration for bumpx:

```bash
# User configuration
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Default branch
git config init.defaultBranch main

# Push configuration
git config push.default simple
git config push.followTags true
```

### Global Aliases

Create helpful Git aliases:

```bash
# Add to ~/.gitconfig
[alias]
    release-patch = "!f() { bumpx patch --commit --tag --push; }; f"
    release-minor = "!f() { bumpx minor --commit --tag --push; }; f"
    release-major = "!f() { bumpx major --prompt --commits --commit --tag --push; }; f"

# Usage
git release-patch
git release-minor
```

### Repository-Specific Config

Project-specific Git settings:

```bash
# In your project directory
git config user.email "project-specific@email.com"
git config commit.template .gitmessage
git config merge.tool vimdiff
```

## Best Practices

### Release Workflow

Recommended release process:

```bash
# 1. Ensure clean state
git status
git pull origin main

# 2. Run tests
npm test

# 3. Version bump with context
bumpx patch --commits --commit --tag

# 4. Push release
git push origin main --tags

# 5. Create GitHub release (optional)
gh release create v1.2.3 --generate-notes
```

### Branch Strategy

Align with your branching model:

**Git Flow:**
```bash
# Development on develop branch
git checkout develop
bumpx prerelease --preid dev --commit

# Release preparation
git checkout -b release/1.2.0
bumpx minor --commit

# Final release on main
git checkout main
git merge release/1.2.0
git tag v1.2.0
git push origin main --tags
```

**GitHub Flow:**
```bash
# Feature development
git checkout -b feature/new-feature

# Ready for release
git checkout main
git merge feature/new-feature
bumpx patch --commit --tag --push
```

### Security Considerations

Secure your release process:

```bash
# Use signed commits for releases
bumpx patch --commit --tag --sign

# Verify signatures
git log --show-signature

# Use SSH for Git operations
git remote set-url origin git@github.com:user/repo.git

# Protect main branch
# (Configure branch protection in GitHub/GitLab)
```

## Troubleshooting

### Common Git Issues

**Authentication failures:**
```bash
# Check remote URL
git remote get-url origin

# Test authentication
git ls-remote origin

# Update token/credentials
git config credential.helper store
```

**Dirty working directory:**
```bash
# See what's changed
git status
git diff

# Stash changes temporarily
git stash
bumpx patch --commit --tag
git stash pop
```

**Merge conflicts:**
```bash
# Resolve conflicts
git status
# Edit conflicted files
git add .
git commit --no-edit

# Continue with version bump
bumpx patch --commit --tag --push
```

**Tag conflicts:**
```bash
# Delete existing tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Create new tag
bumpx patch --tag
```

### Debug Git Operations

Get detailed information about Git operations:

```bash
# Verbose Git operations
export GIT_TRACE=1
bumpx patch --commit --tag --verbose

# Check Git configuration
git config --list
git config --show-origin --list

# Verify repository state
git log --oneline -5
git tag -l
git remote -v
```
