# Monorepo Support

bumpx provides comprehensive support for monorepo projects, allowing you to manage versions across multiple packages with flexible strategies.

## Overview

Monorepos present unique challenges for version management:

- Multiple packages with different release cycles
- Interdependent packages requiring coordinated releases
- Maintaining version consistency across related packages
- Managing git operations across the entire repository

bumpx handles these scenarios with sophisticated detection and management capabilities.

## Package Discovery

### Automatic Detection

bumpx automatically finds all package.json files in your monorepo:

```bash
# Find and update all packages recursively
bumpx patch --recursive

# See what packages would be updated
bumpx patch --recursive --dry-run --verbose
```

### Manual Package Selection

Target specific packages:

```bash
# Update specific packages
bumpx patch --files packages/core/package.json,packages/cli/package.json

# Use glob patterns
bumpx minor --files "packages/*/package.json"
bumpx patch --files "apps/*/package.json,libs/*/package.json"
```

### Exclude Packages

Skip certain packages from updates:

```bash
# Update all except documentation packages
bumpx patch --files "packages/*/package.json" --exclude "**/docs/**"

# Custom selection logic
find packages -name "package.json" -not -path "*/test-*/*" | \
  xargs bumpx patch --files
```

## Versioning Strategies

### Independent Versioning

Each package maintains its own version and release cycle:

```bash
# Bump each package from its current version
bumpx patch --recursive

# Shows current versions before bumping
bumpx minor --recursive --verbose
```

**Example Output:**
```
📦 packages/core/package.json: 1.2.3 → 1.3.0
📦 packages/cli/package.json: 2.1.0 → 2.2.0
📦 packages/utils/package.json: 0.5.2 → 0.6.0
```

### Synchronized Versioning

All packages share the same version:

```bash
# Set all packages to the same version
bumpx patch --recursive --current-version 1.0.0

# Bump all packages to a specific version
bumpx 2.0.0 --recursive
```

**Example Output:**
```
📦 packages/core/package.json: 1.2.3 → 2.0.0
📦 packages/cli/package.json: 2.1.0 → 2.0.0
📦 packages/utils/package.json: 0.5.2 → 2.0.0
```

### Hybrid Approach

Combine strategies for different package groups:

```bash
# Sync core packages
bumpx patch --files "packages/core*/package.json" --current-version 1.0.0

# Independent versioning for apps
bumpx patch --files "apps/*/package.json"

# Tools maintain separate versions
bumpx minor --files "tools/*/package.json"
```

## Workspace Configurations

### NPM Workspaces

bumpx works seamlessly with NPM workspaces:

```json
{
  "name": "my-monorepo",
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

```bash
# Update all workspace packages
bumpx patch --recursive

# Respect workspace configuration
npm run build --workspaces
bumpx minor --recursive --execute "npm run build --workspaces"
```

### Yarn Workspaces

Compatible with Yarn workspace configurations:

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": {
    "packages": ["packages/*", "tools/*"]
  }
}
```

```bash
# Update and build all workspaces
bumpx patch --recursive --execute "yarn workspaces run build"
```

### Pnpm Workspaces

Works with pnpm workspace setups:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'
```

```bash
# Update all packages
bumpx patch --recursive

# Run scripts across workspace
bumpx minor --recursive --execute "pnpm run build --recursive"
```

### Lerna Integration

Integrate with Lerna-managed repositories:

```bash
# Use bumpx instead of lerna version
bumpx patch --recursive --commit --tag

# Combine with Lerna publishing
bumpx minor --recursive --commit --tag --execute "lerna publish from-package"
```

## Dependency Management

### Internal Dependencies

Handle packages that depend on each other:

```json
{
  "name": "@myorg/app",
  "dependencies": {
    "@myorg/core": "^1.2.0",
    "@myorg/utils": "^0.5.0"
  }
}
```

```bash
# Update all packages, preserving dependency relationships
bumpx patch --recursive

# Update dependencies to match new versions
bumpx patch --recursive --execute "npm update @myorg/*"
```

### Version Range Updates

Automatically update internal dependency ranges:

```bash
# Custom script to update dependency versions
cat > scripts/update-deps.js << 'EOF'
const fs = require('fs');
const glob = require('glob');

// Find all package.json files
const packages = glob.sync('packages/*/package.json');

packages.forEach(pkgPath => {
  const pkg = JSON.parse(fs.readFileSync(pkgPath));

  // Update internal dependencies
  if (pkg.dependencies) {
    Object.keys(pkg.dependencies).forEach(dep => {
      if (dep.startsWith('@myorg/')) {
        pkg.dependencies[dep] = '^' + process.env.NEW_VERSION;
      }
    });
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
});
EOF

# Use in version bump workflow
NEW_VERSION=$(bumpx patch --dry-run | grep "→" | head -1 | awk '{print $3}')
bumpx patch --recursive --execute "NEW_VERSION=$NEW_VERSION node scripts/update-deps.js"
```

## Git Operations in Monorepos

### Unified Commits

Create single commits for monorepo releases:

```bash
# Single commit for all package updates
bumpx patch --recursive --commit --message "chore: release all packages to %s"

# Include package details in commit
bumpx minor --recursive --commit --verbose
```

### Selective Commits

Commit packages separately:

```bash
# Commit each package separately
for package in packages/*/package.json; do
  dir=$(dirname "$package")
  name=$(basename "$dir")
  bumpx patch --files "$package" --commit --message "chore($name): release v%s"
done
```

### Tag Strategy

Different tagging approaches for monorepos:

```bash
# Single tag for entire monorepo
bumpx patch --recursive --current-version 1.0.0 --tag --tag-message "monorepo-v%s"

# Package-specific tags
bumpx patch --files packages/core/package.json --tag --tag-message "core-v%s"
bumpx patch --files packages/cli/package.json --tag --tag-message "cli-v%s"
```

## Release Workflows

### Coordinated Releases

Release all packages together:

```bash
#!/bin/bash
# scripts/release.sh

set -e

echo "🚀 Starting monorepo release..."

# Ensure clean state
git status --porcelain | wc -l | xargs test 0 -eq

# Run tests
npm run test --workspaces

# Update versions
bumpx patch --recursive --commit --tag

# Build all packages
npm run build --workspaces

# Push release
git push origin main --tags

echo "✅ Release complete!"
```

### Selective Releases

Release only changed packages:

```bash
#!/bin/bash
# scripts/selective-release.sh

# Find packages with changes since last release
CHANGED_PACKAGES=$(git diff --name-only HEAD~1 | grep "packages/" | cut -d'/' -f1-2 | sort -u)

for package_dir in $CHANGED_PACKAGES; do
  if [ -f "$package_dir/package.json" ]; then
    echo "Releasing $package_dir..."
    bumpx patch --files "$package_dir/package.json" --commit --tag
  fi
done

git push origin main --tags
```

### Canary Releases

Create prerelease versions for testing:

```bash
# Create canary releases for all packages
bumpx prerelease --preid canary --recursive --commit

# Create alpha releases with timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)
bumpx prerelease --preid "alpha.$TIMESTAMP" --recursive --commit
```

## Advanced Configurations

### Conditional Updates

Update packages based on conditions:

```bash
#!/bin/bash
# Only update packages that have changes

git diff --name-only HEAD~1 | while read file; do
  if [[ $file == packages/*/package.json ]]; then
    package_dir=$(dirname "$file")
    echo "Updating $package_dir due to changes"
    bumpx patch --files "$file" --commit
  elif [[ $file == packages/*/* ]]; then
    package_dir=$(echo "$file" | cut -d'/' -f1-2)
    package_json="$package_dir/package.json"
    if [ -f "$package_json" ]; then
      echo "Updating $package_dir due to file changes"
      bumpx patch --files "$package_json" --commit
    fi
  fi
done
```

### Version Constraints

Ensure version relationships:

```bash
#!/bin/bash
# Ensure core package version >= other packages

CORE_VERSION=$(jq -r '.version' packages/core/package.json)

for package in packages/*/package.json; do
  if [[ $package != "packages/core/package.json" ]]; then
    PACKAGE_VERSION=$(jq -r '.version' "$package")

    # Compare versions (simplified)
    if [[ "$PACKAGE_VERSION" > "$CORE_VERSION" ]]; then
      echo "Warning: $package version $PACKAGE_VERSION > core version $CORE_VERSION"
      # Optionally fix the constraint
      bumpx "$CORE_VERSION" --files "$package"
    fi
  fi
done
```

### Build Order Dependencies

Handle build order requirements:

```bash
#!/bin/bash
# Release packages in dependency order

# Define build order
PACKAGES=("packages/utils" "packages/core" "packages/cli" "apps/web")

for package_dir in "${PACKAGES[@]}"; do
  if [ -f "$package_dir/package.json" ]; then
    echo "Building and releasing $package_dir..."

    # Build package
    cd "$package_dir"
    npm run build
    cd - > /dev/null

    # Update version
    bumpx patch --files "$package_dir/package.json" --commit
  fi
done

git push origin main --tags
```

## Configuration Examples

### Monorepo Configuration

Shared configuration for monorepo:

```typescript
// bumpx.config.ts
export default {
  recursive: true,
  commit: true,
  tag: false,
  push: false,
  message: 'chore: release packages',
  execute: 'npm run build --workspaces && npm run test --workspaces',
  files: [
    'packages/*/package.json',
    'apps/*/package.json'
  ]
}
```

Or in package.json:

```json
{
  "name": "my-monorepo",
  "bumpx": {
    "recursive": true,
    "commit": true,
    "tag": false,
    "push": false,
    "message": "chore: release packages",
    "execute": "npm run build --workspaces && npm run test --workspaces",
    "files": [
      "packages/*/package.json",
      "apps/*/package.json"
    ]
  }
}
```

### Package-Specific Configuration

Different configs for different package types:

```typescript
// packages/core/bumpx.config.ts
export default {
  tag: true,
  tagMessage: 'core-v%s',
  execute: 'npm run build && npm run test:integration'
}
```

```typescript
// packages/cli/bumpx.config.ts
export default {
  tag: true,
  tagMessage: 'cli-v%s',
  execute: 'npm run build && npm run test:e2e'
}
```

Or in each package's package.json:

```json
// packages/core/package.json
{
  "name": "@myorg/core",
  "bumpx": {
    "tag": true,
    "tagMessage": "core-v%s",
    "execute": "npm run build && npm run test:integration"
  }
}
```

## Best Practices

### Version Strategy Guidelines

1. **Independent for different domains:** Use independent versioning for packages serving different purposes
2. **Synchronized for related packages:** Use synchronized versioning for tightly coupled packages
3. **Semantic versioning:** Follow semver strictly for public packages
4. **Prerelease testing:** Use prereleases for testing across the monorepo

### Release Process

1. **Test thoroughly:** Run comprehensive tests across all packages
2. **Update dependencies:** Ensure internal dependencies are updated
3. **Document changes:** Maintain changelogs for each package
4. **Automate where possible:** Use scripts to reduce manual errors

### Git Strategy

1. **Single repository:** Keep all related packages in one repository
2. **Clear commit messages:** Use conventional commits with package scopes
3. **Proper tagging:** Use consistent tag naming conventions
4. **Branch protection:** Protect main branch and require reviews

## Troubleshooting

### Common Issues

**Version conflicts:**
```bash
# Check for version mismatches
find packages -name "package.json" -exec jq '.version' {} \; | sort | uniq -c

# Force consistency
bumpx patch --recursive --current-version 1.0.0
```

**Missing packages:**
```bash
# Verify package discovery
bumpx patch --recursive --dry-run --verbose

# Check file patterns
ls packages/*/package.json
```

**Build failures:**
```bash
# Test build before release
npm run build --workspaces || exit 1
bumpx patch --recursive --commit
```

**Dependency issues:**
```bash
# Update all dependencies after version bump
npm update
npm audit fix

# Verify workspace consistency
npm ls --workspaces
```
