# Configuration

bumpx offers flexible configuration options to customize its behavior for your project and team's workflow.

## Configuration Files

### Project Configuration

Create a configuration file in your project root for project-specific defaults. bumpx supports multiple configuration file formats:

**TypeScript/JavaScript configuration files:**
```typescript
// bumpx.config.ts
export default {
  commit: true,
  tag: true,
  push: false,
  sign: true,
  message: 'chore: release v%s',
  tagMessage: 'Release v%s',
  files: ['package.json', 'package-lock.json'],
  preid: 'alpha',
  noGitCheck: false,
  noVerify: false,
  recursive: false,
  install: false,
  execute: ''
}
```

```javascript
// bumpx.config.js
module.exports = {
  commit: true,
  tag: true,
  push: false,
  sign: true,
  message: 'chore: release v%s',
  tagMessage: 'Release v%s',
  files: ['package.json', 'package-lock.json'],
  preid: 'alpha',
  noGitCheck: false,
  noVerify: false,
  recursive: false,
  install: false,
  execute: ''
}
```

**Package.json configuration:**
```json
{
  "name": "my-project",
  "version": "1.0.0",
  "bumpx": {
    "commit": true,
    "tag": true,
    "push": false,
    "sign": true,
    "message": "chore: release v%s",
    "tagMessage": "Release v%s",
    "files": ["package.json", "package-lock.json"],
    "preid": "alpha"
  }
}
```

**Alternative config directory locations:**
```bash
# In .config directory
.config/bumpx.ts
.config/bumpx.js
.config/bumpx.mjs
.config/bumpx.cjs

# In config directory
config/bumpx.ts
config/bumpx.js
config/bumpx.mjs
config/bumpx.cjs
```

### Global Configuration

Create a global configuration in your home directory:

```typescript
// ~/.config/bumpx.config.ts
export default {
  sign: true,
  push: false,
  verbose: true,
  message: 'chore: bump version to %s',
  tagMessage: 'v%s'
}
```

Or in package.json within a global npm project:

```json
{
  "bumpx": {
    "sign": true,
    "push": false,
    "verbose": true,
    "message": "chore: bump version to %s",
    "tagMessage": "v%s"
  }
}
```

### Configuration Priority

Configuration is applied in this order (later options override earlier ones):

1. Global configuration (`~/.config/bumpx.config.*` or global package.json)
2. Project configuration (local config files or package.json)
3. Command line arguments
4. Environment variables

### Supported Configuration File Names

bumpx looks for configuration files in this order:

1. `bumpx.config.ts`
2. `bumpx.config.js`
3. `bumpx.config.mjs`
4. `bumpx.config.cjs`
5. `.config/bumpx.config.ts`
6. `.config/bumpx.config.js`
7. `.config/bumpx.config.mjs`
8. `.config/bumpx.config.cjs`
9. `config/bumpx.config.ts`
10. `config/bumpx.config.js`
11. `config/bumpx.config.mjs`
12. `config/bumpx.config.cjs`
13. `package.json` (bumpx key)

## Configuration Options

### Version Control

#### `commit` (boolean)
- **Default:** `false`
- **Description:** Automatically create a git commit after version bump
- **CLI:** `--commit` / `--no-commit`

```json
{
  "commit": true
}
```

#### `tag` (boolean)
- **Default:** `false`
- **Description:** Create a git tag after version bump
- **CLI:** `--tag` / `--no-tag`

```json
{
  "tag": true
}
```

#### `push` (boolean)
- **Default:** `false`
- **Description:** Push commits and tags to remote repository
- **CLI:** `--push` / `--no-push`

```json
{
  "push": true
}
```

#### `sign` (boolean)
- **Default:** `false`
- **Description:** Sign git commits and tags with GPG
- **CLI:** `--sign` / `--no-sign`

```json
{
  "sign": true
}
```

### Messages

#### `message` (string)
- **Default:** `"chore: bump version to %s"`
- **Description:** Git commit message template (use %s for version)
- **CLI:** `--message`

```json
{
  "message": "release: v%s"
}
```

#### `tagMessage` (string)
- **Default:** `"v%s"`
- **Description:** Git tag message template (use %s for version)
- **CLI:** `--tag-message`

```json
{
  "tagMessage": "Release version %s"
}
```

### File Operations

#### `files` (string[])
- **Default:** `["package.json"]`
- **Description:** List of files to update with new version
- **CLI:** `--files`

```json
{
  "files": [
    "package.json",
    "package-lock.json",
    "VERSION.txt",
    "src/version.ts"
  ]
}
```

#### `recursive` (boolean)
- **Default:** `false`
- **Description:** Search for package.json files in subdirectories
- **CLI:** `--recursive` / `--no-recursive`

```json
{
  "recursive": true
}
```

### Version Configuration

#### `preid` (string)
- **Default:** `"alpha"`
- **Description:** Prerelease identifier for prerelease versions
- **CLI:** `--preid`

```json
{
  "preid": "beta"
}
```

#### `currentVersion` (string)
- **Default:** Auto-detected from files
- **Description:** Override the current version for all files
- **CLI:** `--current-version`

```json
{
  "currentVersion": "1.0.0"
}
```

### Git Behavior

#### `noGitCheck` (boolean)
- **Default:** `false`
- **Description:** Skip git status check (allows dirty working directory)
- **CLI:** `--no-git-check`

```json
{
  "noGitCheck": true
}
```

#### `noVerify` (boolean)
- **Default:** `false`
- **Description:** Skip git hooks when committing
- **CLI:** `--no-verify`

```json
{
  "noVerify": true
}
```

### Post-Bump Actions

#### `install` (boolean)
- **Default:** `false`
- **Description:** Run `npm install` after version bump
- **CLI:** `--install` / `--no-install`

```json
{
  "install": true
}
```

#### `execute` (string)
- **Default:** `""`
- **Description:** Command to run after version bump
- **CLI:** `--execute`

```json
{
  "execute": "bun run build && bun run test"
}
```

### Output Control

#### `verbose` (boolean)
- **Default:** `false`
- **Description:** Enable verbose output
- **CLI:** `--verbose` / `--quiet`

```json
{
  "verbose": true
}
```

#### `dryRun` (boolean)
- **Default:** `false`
- **Description:** Show what would be done without making changes
- **CLI:** `--dry-run`

```json
{
  "dryRun": true
}
```

## Environment Variables

You can also configure bumpx using environment variables:

```bash
# Set default behavior via environment variables
export BUMPX_COMMIT=true
export BUMPX_TAG=true
export BUMPX_PUSH=false
export BUMPX_SIGN=true
export BUMPX_MESSAGE="chore: release v%s"
export BUMPX_VERBOSE=true
```

## Configuration Examples

### Basic Release Workflow

For a simple release workflow with automatic git operations:

```json
{
  "commit": true,
  "tag": true,
  "push": true,
  "message": "chore: release v%s",
  "tagMessage": "Release v%s"
}
```

### Monorepo Configuration

For managing multiple packages in a monorepo:

```json
{
  "recursive": true,
  "commit": true,
  "tag": true,
  "message": "chore: bump all packages to v%s",
  "files": [
    "package.json",
    "packages/*/package.json"
  ]
}
```

### CI/CD Integration

For automated releases in CI environments:

```json
{
  "commit": true,
  "tag": true,
  "push": true,
  "noVerify": true,
  "execute": "bun run build && bun run test:ci",
  "message": "chore(release): v%s [skip ci]"
}
```

### Development Workflow

For development with prerelease versions:

```json
{
  "preid": "dev",
  "commit": true,
  "tag": false,
  "push": false,
  "message": "chore: dev release v%s"
}
```

### Security-Focused

For projects requiring signed commits:

```json
{
  "sign": true,
  "commit": true,
  "tag": true,
  "noGitCheck": false,
  "noVerify": false,
  "message": "chore: secure release v%s",
  "tagMessage": "Signed release v%s"
}
```

## Advanced Configuration

### Custom File Patterns

Support for complex file patterns:

```json
{
  "files": [
    "package.json",
    "apps/*/package.json",
    "libs/*/package.json",
    "VERSION",
    "src/constants/version.ts",
    "docs/package.json"
  ]
}
```

### Conditional Configuration

Use different configurations for different scenarios:

```bash
# Development releases
bumpx prerelease --config bumpx.config.dev.ts

# Production releases
bumpx minor --config bumpx.config.prod.ts

# Hotfix releases
bumpx patch --config bumpx.config.hotfix.ts
```

### Team Configuration

Share configuration across your team by committing configuration files:

```typescript
// bumpx.config.ts - committed to version control
export default {
  commit: true,
  tag: true,
  push: false,
  sign: false,
  message: 'chore: release v%s',
  files: [
    'package.json',
    'package-lock.json'
  ],
  execute: 'bun run build && bun run test'
}
```

## Migration from Other Tools

### From `npm version`

If you're coming from `npm version`, this configuration provides similar behavior:

```json
{
  "commit": true,
  "tag": true,
  "push": false,
  "message": "v%s",
  "tagMessage": "v%s"
}
```

### From `bumpp`

For users migrating from `bumpp`:

```json
{
  "commit": true,
  "tag": true,
  "push": true,
  "execute": "bun run build",
  "message": "chore: release v%s"
}
```

## Validation

bumpx validates your configuration and will warn about:

- Invalid option combinations
- Malformed message templates
- Inaccessible file patterns
- Git configuration issues

To validate your configuration:

```bash
# Test configuration without making changes
bumpx patch --dry-run --verbose
```

## Best Practices

1. **Start Simple:** Begin with basic options and add complexity as needed
2. **Use Project Config:** Commit configuration files to share team standards
3. **Document Changes:** Use clear commit messages that explain the release
4. **Test First:** Always use `--dry-run` when testing new configurations
5. **Secure Releases:** Enable signing for production releases
6. **Automate Safely:** Use `--no-verify` carefully in CI environments

## Troubleshooting

### Common Configuration Issues

**Config not loading:**
```bash
# Check config file syntax (for TypeScript/JavaScript files)
npx tsc --noEmit bumpx.config.ts

# Use explicit config file
bumpx patch --config ./my-config.ts
```

**Git operations failing:**
```bash
# Check git configuration
git config --list | grep user
git config --list | grep signing

# Test git operations manually
git commit --allow-empty -m "test commit"
```

**File patterns not working:**
```bash
# Test file patterns
ls -la package.json packages/*/package.json

# Use verbose mode to see file resolution
bumpx patch --dry-run --verbose
```
