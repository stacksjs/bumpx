# Version Bumping

bumpx provides comprehensive version bumping capabilities following semantic versioning (semver) standards.

## Semantic Versioning Support

bumpx fully supports semantic versioning with the format `MAJOR.MINOR.PATCH`:

### Standard Version Types

```bash
# Patch: Bug fixes (1.0.0 → 1.0.1)
bumpx patch

# Minor: New features (1.0.0 → 1.1.0)
bumpx minor

# Major: Breaking changes (1.0.0 → 2.0.0)
bumpx major
```

### Prerelease Versions

Create prerelease versions for testing and staging:

```bash
# Prerelease from current version (1.0.0 → 1.0.1-alpha.0)
bumpx prerelease

# Prerelease with custom identifier
bumpx prerelease --preid beta    # → 1.0.1-beta.0
bumpx prerelease --preid rc      # → 1.0.1-rc.0

# Prerelease increments
bumpx premajor --preid alpha     # → 2.0.0-alpha.0
bumpx preminor --preid beta      # → 1.1.0-beta.0
bumpx prepatch --preid rc        # → 1.0.1-rc.0
```

### Exact Version Setting

Set specific versions when needed:

```bash
# Set exact version
bumpx 2.1.0

# Set prerelease version
bumpx 3.0.0-beta.5

# Set version with build metadata
bumpx 1.2.3+build.123
```

## Interactive Version Selection

Use prompt mode for guided version selection:

```bash
# Interactive version picker
bumpx prompt

# With recent commit context
bumpx prompt --commits
```

The interactive mode shows:
- Current version
- Available bump types
- Recent commits (if `--commits` flag used)
- Preview of new version

## Multi-File Version Management

### File Detection

bumpx automatically detects version files:

```bash
# Updates package.json in current directory
bumpx patch

# Recursively find all package.json files
bumpx patch --recursive

# Specify custom files
bumpx patch --files package.json,VERSION.txt,src/version.ts
```

### File Format Support

bumpx supports multiple file formats:

**JSON Files (package.json, manifest.json):**
```json
{
  "version": "1.2.3"
}
```

**Plain Text Files (VERSION, VERSION.txt):**
```
1.2.3
```

**Source Code Files (src/version.ts, lib/version.py):**
```typescript
export const VERSION = '1.2.3'
```

```python
__version__ = '1.2.3'
```

**YAML Files (pubspec.yaml, Chart.yaml):**
```yaml
version: 1.2.3
```

### Pattern Matching

bumpx uses intelligent pattern matching to find versions:

- `"version": "1.2.3"` (JSON)
- `version = "1.2.3"` (TOML, config files)
- `VERSION = '1.2.3'` (Python, JavaScript)
- `version: 1.2.3` (YAML)
- Plain version strings in text files

## Monorepo Support

### Independent Versioning

Each package maintains its own version:

```bash
# Bump each package from its current version
bumpx patch --recursive
```

### Synchronized Versioning

All packages share the same version:

```bash
# Set all packages to the same version
bumpx patch --recursive --current-version 1.0.0
```

### Selective Updates

Target specific packages:

```bash
# Update specific package directories
bumpx patch --files packages/core/package.json,packages/cli/package.json

# Use glob patterns
bumpx minor --files "packages/*/package.json"
```

## Version Validation

bumpx validates versions at every step:

### Current Version Detection

```bash
# Automatically detects current version
bumpx patch

# Override if detection fails
bumpx patch --current-version 1.2.3

# Verbose mode shows detection process
bumpx patch --verbose
```

### Semver Compliance

Ensures all versions follow semantic versioning:

- Validates format: `MAJOR.MINOR.PATCH`
- Supports prerelease: `1.0.0-alpha.1`
- Supports build metadata: `1.0.0+build.1`
- Rejects invalid formats

### Cross-File Consistency

Checks version consistency across files:

```bash
# Warns if files have different versions
bumpx patch --verbose

# Forces consistency with override
bumpx patch --current-version 1.0.0
```

## Advanced Version Operations

### Conditional Bumping

Skip files that don't need updates:

```bash
# Only updates files that match current version
bumpx patch --current-version 1.0.0

# Dry run to see which files would be updated
bumpx patch --dry-run --verbose
```

### Version Rollback

While bumpx doesn't directly support rollback, you can manually revert:

```bash
# See what version to rollback to
git log --oneline -5

# Reset to previous commit
git reset --hard HEAD~1

# Or manually set previous version
bumpx 1.2.2  # if current is 1.2.3
```

### Custom Version Logic

For complex version schemes:

```bash
# Build numbers
bumpx 1.2.3+build.$(date +%Y%m%d)

# Custom prerelease schemes
bumpx 1.0.0-dev.$(git rev-parse --short HEAD)

# Date-based versions
bumpx $(date +%Y.%m.%d)
```

## Integration with Build Tools

### NPM Integration

bumpx works alongside NPM scripts:

```json
{
  "scripts": {
    "release:patch": "bumpx patch --commit --tag",
    "release:minor": "bumpx minor --commit --tag --execute 'npm run build'",
    "release:major": "bumpx major --prompt --commits --commit --tag --push"
  }
}
```

### CI/CD Integration

Automated version bumping in CI:

```yaml
# GitHub Actions example
- name: Bump version
  run: |
    bumpx patch --commit --tag --push
    npm publish
```

### Git Hook Integration

Pre-commit version validation:

```bash
#!/bin/sh
# .git/hooks/pre-commit
bumpx --dry-run --verbose || exit 1
```

## Best Practices

### Version Strategy

1. **Patch:** Bug fixes, security updates
2. **Minor:** New features, non-breaking changes
3. **Major:** Breaking changes, API changes

### Release Process

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Development and testing
# ... make changes ...

# 3. Ready for release
git checkout main
git merge feature/new-feature

# 4. Version bump with full git workflow
bumpx minor --commit --tag --push --execute "npm run build"

# 5. Publish
npm publish
```

### Team Workflow

Establish consistent practices:

```typescript
// bumpx.config.ts - shared team configuration
export default {
  commit: true,
  tag: true,
  push: false,
  message: 'chore: release v%s',
  execute: 'npm run build && npm run test'
}
```

## Troubleshooting

### Common Issues

**Version detection fails:**
```bash
# Specify current version manually
bumpx patch --current-version 1.0.0

# Check file format
cat package.json | jq .version
```

**Inconsistent versions across files:**
```bash
# See which files have different versions
bumpx patch --dry-run --verbose

# Force consistency
bumpx patch --current-version 1.0.0
```

**Invalid version format:**
```bash
# Check current version format
bumpx --version

# Validate semver format
node -e "console.log(require('semver').valid('1.2.3'))"
```

### Debug Mode

Enable detailed logging:

```bash
# See every operation
bumpx patch --verbose

# Test without changes
bumpx patch --dry-run --verbose
```
