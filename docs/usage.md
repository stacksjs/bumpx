# Basic Usage

This guide covers the essential commands and workflows for using bumpx in your daily development.

## Version Bumping

The core functionality of bumpx is version bumping across your project files.

### Simple Version Bumps

Bump the version in your current directory:

```bash
# Patch version bump (1.0.0 → 1.0.1)
bumpx patch

# Minor version bump (1.0.0 → 1.1.0)
bumpx minor

# Major version bump (1.0.0 → 2.0.0)
bumpx major
```

### Prerelease Versions

Create prerelease versions for testing:

```bash
# Create a prerelease version (1.0.0 → 1.0.1-alpha.0)
bumpx prerelease

# Specify custom prerelease identifier
bumpx prerelease --preid beta  # → 1.0.1-beta.0

# Prerelease bumps
bumpx premajor --preid rc      # → 2.0.0-rc.0
bumpx preminor --preid alpha   # → 1.1.0-alpha.0
bumpx prepatch --preid beta    # → 1.0.1-beta.0
```

### Specific Version

Set an exact version:

```bash
# Set specific version
bumpx 2.1.0

# Set prerelease version
bumpx 2.1.0-beta.3
```

### Interactive Mode

Use interactive mode to choose your version:

```bash
# Interactive version selection
bumpx prompt

# Shows recent commits for context
bumpx prompt --commits
```

## File Operations

### Target Specific Files

By default, bumpx looks for `package.json` in your current directory. You can specify different files:

```bash
# Update specific files
bumpx patch --files package.json,package-lock.json

# Update multiple package.json files
bumpx minor --files packages/*/package.json

# Include non-JSON files (searches for version patterns)
bumpx patch --files VERSION.txt,README.md
```

### Recursive Updates

Update all package.json files in subdirectories:

```bash
# Update all package.json files recursively
bumpx patch --recursive

# Show what would be updated without making changes
bumpx patch --recursive --dry-run
```

### Current Version Override

When working with multiple packages that should share the same version:

```bash
# Set a common starting version for all files
bumpx patch --current-version 1.2.3

# Useful for monorepos with synchronized versions
bumpx minor --current-version 2.0.0 --recursive
```

## Git Integration

### Automatic Git Operations

Commit and tag your version bumps automatically:

```bash
# Create git commit with default message
bumpx patch --commit

# Create git commit and tag
bumpx minor --commit --tag

# Create signed commit and tag
bumpx major --commit --tag --sign

# Push to remote after operations
bumpx patch --commit --tag --push
```

### Custom Commit Messages

Customize your commit and tag messages:

```bash
# Custom commit message (use %s for version)
bumpx patch --commit --message "chore: bump version to %s"

# Custom tag message
bumpx minor --commit --tag --tag-message "Release v%s"
```

### Skip Git Checks

Bypass git status checks when needed:

```bash
# Skip git status check (allows dirty working directory)
bumpx patch --commit --no-git-check

# Skip git hooks
bumpx minor --commit --no-verify
```

## Advanced Options

### Progress Tracking

Monitor the bump process in detail:

```bash
# Show detailed progress
bumpx patch --verbose

# Show recent commits for context
bumpx minor --commits

# Combination of both
bumpx major --verbose --commits
```

### Dry Run

Preview changes without making them:

```bash
# See what would be changed
bumpx patch --dry-run

# Dry run with git operations
bumpx minor --dry-run --commit --tag
```

### Post-Bump Scripts

Run custom commands after version bump:

```bash
# Run npm scripts after bump
bumpx patch --commit --execute "bun run build"

# Multiple commands
bumpx minor --execute "bun run build && bun run test"

# Install dependencies after bump
bumpx patch --install
```

## Common Workflows

### Development Release

Quick patch for bug fixes:

```bash
bumpx patch --commit --tag --push
```

### Feature Release

Release with documentation update:

```bash
bumpx minor --commit --tag --execute "bun run build:docs" --push
```

### Major Release

Comprehensive major version release:

```bash
# Interactive selection with full git workflow
bumpx prompt --commits --commit --tag --sign --push --execute "bun run build"
```

### Prerelease Testing

Create prerelease for testing:

```bash
# Alpha release
bumpx prerelease --preid alpha --commit --tag

# Beta release
bumpx prerelease --preid beta --commit --tag --push
```

### Monorepo Management

Update all packages in a monorepo:

```bash
# Synchronized version across all packages
bumpx patch --recursive --current-version 1.0.0 --commit --tag

# Independent versioning
bumpx patch --recursive --commit
```

## Configuration

### Global Configuration

Set default options in your shell profile:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias bump-patch='bumpx patch --commit --tag'
alias bump-minor='bumpx minor --commit --tag --push'
alias bump-major='bumpx major --prompt --commits --commit --tag --push'
```

### Project Configuration

Create a configuration file in your project. bumpx supports multiple formats:

**TypeScript configuration:**
```typescript
// bumpx.config.ts
export default {
  commit: true,
  tag: true,
  push: false,
  sign: true,
  message: 'chore: release v%s',
  tagMessage: 'Release v%s'
}
```

**JavaScript configuration:**
```javascript
// bumpx.config.js
module.exports = {
  commit: true,
  tag: true,
  push: false,
  sign: true,
  message: 'chore: release v%s',
  tagMessage: 'Release v%s'
}
```

**Package.json configuration:**
```json
{
  "name": "my-project",
  "bumpx": {
    "commit": true,
    "tag": true,
    "push": false,
    "sign": true,
    "message": "chore: release v%s",
    "tagMessage": "Release v%s"
  }
}
```

## Error Handling

### Common Issues

**Dirty working directory:**
```bash
# Allow dirty working directory
bumpx patch --no-git-check

# Or commit changes first
git add . && git commit -m "work in progress"
bumpx patch --commit
```

**No package.json found:**
```bash
# Specify files explicitly
bumpx patch --files ./package.json

# Or check current directory
ls -la package.json
```

**Git authentication issues:**
```bash
# Ensure git credentials are set up
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# For signed commits
git config --global user.signingkey YOUR_KEY_ID
```

### Troubleshooting

Enable verbose mode to see detailed operations:

```bash
# Verbose output shows each step
bumpx patch --verbose

# Check git status manually
git status
git log --oneline -5
```

## Next Steps

- [Configuration Guide](./config.md) - Set up default options and aliases
- [Version Bumping Features](./features/version-bumping.md) - Explore semantic versioning capabilities
- [Git Integration](./features/git-integration.md) - Learn about Git workflow automation
- [Monorepo Support](./features/monorepo-support.md) - Manage multiple packages
- [Advanced Usage](./advanced/cross-platform.md) - Cross-platform considerations
