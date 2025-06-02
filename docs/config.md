# Configuration

bumpx can be configured using a configuration file or through command-line options. This guide explains all available configuration options and how to use them.

## Configuration File

bumpx looks for configuration in these locations (in order of precedence):

1. `.bumpx.json` or `bumpx.config.ts` in the current directory
2. `~/.bumpxrc` or `~/.config/bumpx/config.json` in your home directory

Example configuration file (`bumpx.config.ts`):

```ts
import type { bumpxConfig } from 'bumpx'
import os from 'node:os'
import path from 'node:path'

const config: bumpxConfig = {
  // Enable verbose logging (default: false)
  verbose: true,

  // Path where binaries should be installed
  // (default: /usr/local if writable, ~/.local otherwise)
  installationPath: '/usr/local',

  // Whether to enable dev-aware installations (default: true)
  devAware: true,

  // Whether to auto-elevate with sudo when needed (default: true)
  autoSudo: true,

  // Max installation retries on failure (default: 3)
  maxRetries: 3,

  // Timeout for pkgx operations in milliseconds (default: 60000)
  timeout: 60000,

  // Whether to symlink versions (default: true)
  symlinkVersions: true,

  // Whether to force reinstall if already installed (default: false)
  forceReinstall: false,

  // Default path for shims (default: ~/.local/bin)
  shimPath: path.join(os.homedir(), '.local', 'bin'),

  // Whether to automatically add shim path to the system PATH (default: true)
  autoAddToPath: true,
}

export default config
```

JavaScript format (`.bumpxrc`):

```json
{
  "verbose": true,
  "installationPath": "/usr/local",
  "autoSudo": true,
  "maxRetries": 3,
  "timeout": 60000,
  "symlinkVersions": true,
  "forceReinstall": false,
  "shimPath": "~/.local/bin",
  "autoAddToPath": true
}
```

## Configuration Options

### General Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `verbose` | boolean | `false` | Enable detailed logging |
| `installationPath` | string | `/usr/local` or `~/.local` | Path where packages should be installed |
| `shimPath` | string | `~/.local/bin` | Path where shims should be created |

### Installation Behavior

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `devAware` | boolean | `true` | Enable dev-aware installations |
| `maxRetries` | number | `3` | Maximum retries for installation |
| `timeout` | number | `60000` | Timeout for operations in milliseconds |
| `symlinkVersions` | boolean | `true` | Whether to symlink versions |
| `forceReinstall` | boolean | `false` | Force reinstallation even if already installed |

### Permission Management

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoSudo` | boolean | `true` | Automatically use sudo when needed |

### Path Management

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoAddToPath` | boolean | `true` | Automatically add shim directories to PATH |

## Environment Variables

You can also configure bumpx using environment variables:

| Environment Variable | Description |
|----------------------|-------------|
| `bumpx_VERBOSE` | Enable verbose logging |
| `bumpx_INSTALL_PATH` | Set installation path |
| `bumpx_SHIM_PATH` | Set shim path |
| `bumpx_AUTO_SUDO` | Enable/disable auto sudo |
| `bumpx_AUTO_ADD_PATH` | Enable/disable auto PATH modification |
| `bumpx_ENV_BASE_DIR` | Set base directory for project environments |
| `bumpx_AUTO_ACTIVATE_ENV` | Enable/disable automatic environment activation |
| `bumpx_SHOW_ENV_MESSAGES` | Enable/disable environment activation messages |
| `bumpx_ENV_CLEANUP_DAYS` | Default age threshold for environment cleanup |

Example:

```bash
bumpx_VERBOSE=true bumpx_INSTALL_PATH=~/apps bumpx install node@22
```

## Command-Line Overrides

Options specified on the command line take precedence over configuration files:

```bash
# Override installation path
bumpx install --path ~/custom-path node@22

# Force reinstallation
bumpx shim --force node

# Disable auto PATH modification
bumpx dev --no-auto-path

# Install specific Bun version
bumpx bun --version 1.0.0

# Bootstrap with custom options
bumpx bootstrap --skip-bun --verbose

# Remove packages with dry-run preview
bumpx remove python --dry-run

# Complete removal without confirmation
bumpx uninstall --force

# Keep specific components during uninstall
bumpx uninstall --keep-shell-integration

# Generate environment script with options
bumpx dev:dump --verbose --dryrun

# Quiet installation
bumpx install --quiet node@22
```

## Development Environment Configuration

### Project-Level Configuration

Create a `dependencies.yaml` file in your project root:

```yaml
dependencies:
  - node@22
  - python@3.12
  - gnu.org/wget@1.21

env:
  NODE_ENV: development
  API_URL: https://api.example.com
  DATABASE_URL: postgresql://localhost/myapp
```

### Global Environment Configuration

Set global environment defaults in your bumpx config:

```ts
const config: bumpxConfig = {
  // Global environment variables for all projects
  globalEnv: {
    EDITOR: 'code',
    BROWSER: 'chrome',
  },

  // Default packages to include in all environments
  defaultPackages: [
    'git',
    'curl.se',
  ],
}
```

### Environment Isolation Settings

Configure how project environments are isolated:

```ts
const config: bumpxConfig = {
  // Base directory for project environments
  envBaseDir: path.join(os.homedir(), '.local', 'share', 'bumpx', 'envs'),

  // Whether to automatically activate environments when entering directories
  autoActivateEnv: true,

  // Whether to show activation/deactivation messages
  showEnvMessages: true,

  // Environment cleanup settings
  envCleanup: {
    // Default age threshold for cleaning old environments (in days)
    defaultOlderThanDays: 30,

    // Whether to automatically clean failed installations
    autoCleanFailedInstalls: true,

    // Whether to prompt before cleaning environments
    promptBeforeClean: true,
  },

  // Environment hash format settings
  envHash: {
    // Length of hex hash portion (default: 8)
    hashLength: 8,

    // Whether to include project name in hash (default: true)
    includeProjectName: true,

    // Character to separate project name from hash (default: '_')
    separator: '_',
  },
}
```

## Advanced Configuration

### Custom Binary Stubs

Configure how binary stubs are created:

```ts
const config: bumpxConfig = {
  // Template for binary stub scripts
  stubTemplate: `#!/bin/sh
# Custom stub template
export CUSTOM_VAR=value
exec "{binary}" "$@"
`,

  // Whether to create isolated stubs (recommended)
  isolatedStubs: true,
}
```

### Package Resolution

Configure package resolution behavior:

```ts
const config: bumpxConfig = {
  // Custom package registry URLs
  registries: [
    'https://pkgx.sh/packages',
    'https://custom-registry.com',
  ],

  // Package name aliases
  aliases: {
    node: 'nodejs.org',
    python: 'python.org',
  },
}
```

### Installation Paths

Configure different installation paths for different types of packages:

```ts
const config: bumpxConfig = {
  // Default installation path (can be overridden with --system or --path)
  installationPath: '/usr/local', // Set to always use /usr/local

  // Runtime-specific installation paths
  runtimePaths: {
    'nodejs.org': '/opt/node',
    'python.org': '/opt/python',
  },

  // System vs user installation preference
  preferUserInstall: false, // Set to true to prefer ~/.local over /usr/local

  // Whether to prompt for sudo when installing to system directories
  promptForSudo: true,
}
```

## Platform-Specific Configuration

### macOS Configuration

```ts
const config: bumpxConfig = {
  // Use Homebrew paths when available
  useHomebrewPaths: true,

  // macOS-specific binary directories
  macBinaryPaths: [
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ],
}
```

### Linux Configuration

```ts
const config: bumpxConfig = {
  // Linux-specific paths
  linuxBinaryPaths: [
    '/usr/local/bin',
    '/usr/bin',
    '/opt/bin',
  ],

  // Whether to use system package manager as fallback
  useSystemPackageManager: true,
}
```

### Windows Configuration

```ts
const config: bumpxConfig = {
  // Windows-specific paths
  windowsBinaryPaths: [
    'C:\\Program Files\\bumpx\\bin',
    '%USERPROFILE%\\.local\\bin',
  ],

  // Whether to add .exe extension automatically
  autoAddExeExtension: true,
}
```

## Troubleshooting Configuration

### Debugging Configuration

Enable configuration debugging:

```bash
bumpx_DEBUG_CONFIG=true bumpx version
```

### Configuration Validation

Validate your configuration:

```bash
bumpx config:validate
```

### Configuration Location

Find where bumpx is loading configuration from:

```bash
bumpx config:show
```
