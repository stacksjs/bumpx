# Basic Usage

bumpx provides a simple yet powerful command-line interface for managing packages and development environments. This guide covers the most common operations.

## Command Overview

Here are the main commands available in bumpx:

| Command | Description |
|---------|-------------|
| `install` or `i` | Install packages |
| `remove` or `rm` | Remove specific packages |
| `shim` | Create shims for packages |
| `pkgx` | Install pkgx itself |
| `dev` | Install the dev package |
| `dev:dump` | Generate environment setup script for a project |
| `dev:shellcode` | Generate shell integration code |
| `bun` | Install Bun runtime directly |
| `zsh` | Install Zsh shell |
| `bootstrap` | Install all essential tools at once |
| `list` or `ls` | List installed packages |
| `uninstall` | Complete removal of bumpx and all packages |
| `env:list` or `env:ls` | List all development environments |
| `env:clean` | Clean up unused development environments |
| `env:inspect` | Inspect a specific development environment |
| `env:remove` | Remove a specific development environment |
| `env:update` | Update package versions in dependencies.yaml |
| `autoupdate` | Check auto-update status |
| `autoupdate:enable` | Enable auto-updates |
| `autoupdate:disable` | Disable auto-updates |
| `version` | Show version information |
| `help` | Display help information |

## Installing Packages

Install one or more packages using the `install` or `i` command:

```bash
# Install a single package (defaults to /usr/local if writable)
bumpx install node@22

# Install multiple packages
bumpx install python@3.12 ruby@3.3

# Short form
bumpx i go

# Install to a specific location
bumpx install --path ~/my-packages node
```

### Installation Locations

bumpx provides flexible installation options:

- **Default behavior**: Installs to `/usr/local` if writable, otherwise to `~/.local`
- **System-wide installation**: The default behavior already installs system-wide to `/usr/local`
- **Custom path**: Use `--path <path>` to specify any installation directory
- **User installation**: Use `--path ~/.local` to force user-local installation

```bash
# Examples of different installation methods
bumpx install node                    # Installs to /usr/local (default)
bumpx install node --system           # Same as above (redundant flag)
bumpx install node --path /opt/tools  # Custom directory
bumpx install node --path ~/.local    # Force user directory
```

**Permission Handling**: When installing to `/usr/local` without sufficient permissions, bumpx will:
- Detect the permission issue
- Prompt you interactively (if in a terminal)
- Offer to re-run with `sudo` automatically
- Provide clear alternatives if you decline

## Removing Packages

Remove specific packages while keeping the rest of your bumpx setup intact:

```bash
# Remove a single package
bumpx remove python

# Remove multiple packages
bumpx rm node python ruby

# Remove a specific version
bumpx remove node@22

# Preview what would be removed without actually removing it
bumpx remove python --dry-run

# Remove without confirmation prompts
bumpx remove python --force

# Remove with verbose output showing all files
bumpx remove python --verbose
```

The `remove` command intelligently finds and removes:
- Binaries from `bin/` and `sbin/` directories
- Package-specific directories
- Associated shims
- Symlinks pointing to the package

## Development Environment Management

bumpx provides powerful project-specific environment management:

### Auto-Activation with Shell Integration

Set up shell integration to automatically activate environments when entering project directories:

```bash
# Add to your shell configuration
echo 'eval "$(bumpx dev:shellcode)"' >> ~/.zshrc

# Reload your shell
source ~/.zshrc
```

Once set up, environments automatically activate when you enter a directory with dependency files:

```bash
cd my-project/  # → Automatically activates environment
# ✅ Environment activated for /path/to/my-project
cd ../          # → Automatically deactivates
# 🔄 dev environment deactivated
```

### Manual Environment Commands

```bash
# Generate environment script for current directory
bumpx dev:dump

# Generate environment script for specific directory
bumpx dev:dump /path/to/project

# Preview packages without generating script
bumpx dev:dump --dryrun

# Generate script with verbose output
bumpx dev:dump --verbose
```

### Project-Specific Dependencies

Create a `dependencies.yaml` file in your project:

```yaml
dependencies:
  - node@22
  - python@3.12
  - gnu.org/wget@1.21

env:
  NODE_ENV: development
  PROJECT_NAME: my-awesome-project
```

Supported dependency file formats:
- `dependencies.yaml` / `dependencies.yml`
- `pkgx.yaml` / `pkgx.yml`
- `.pkgx.yaml` / `.pkgx.yml`

### Environment Isolation

Each project gets its own isolated environment:
- Project-specific installation directory: `~/.local/share/bumpx/envs/{project-hash}/`
- Isolated PATH and environment variables
- Binary stubs with environment isolation
- Automatic cleanup when leaving project directory

## Environment Management

bumpx provides comprehensive tools for managing development environments with human-readable identifiers.

### Listing Environments

View all your development environments:

```bash
# List all environments in a table format
bumpx env:list

# Show detailed information including hashes
bumpx env:list --verbose

# Output as JSON for scripting
bumpx env:list --format json

# Simple format for quick overview
bumpx env:ls --format simple
```

**Example Output:**
```
📦 Development Environments:

│ Project         │ Packages │ Binaries │ Size     │ Created      │
├───────────────────────────────────────────────────────────────┤
│ final-project   │ 2        │ 2        │ 5.0M     │ 5/30/2025    │
│ working-test    │ 3        │ 20       │ 324M     │ 5/30/2025    │
│ dummy           │ 1        │ 1        │ 1.1M     │ 5/30/2025    │
└───────────────────────────────────────────────────────────────┘

Total: 3 environment(s)
```

### Inspecting Environments

Get detailed information about a specific environment:

```bash
# Basic inspection
bumpx env:inspect working-test_208a31ec

# Detailed inspection with directory structure
bumpx env:inspect final-project_7db6cf06 --verbose

# Show binary stub contents
bumpx env:inspect dummy_6d7cf1d6 --show-stubs
```

**Example Output:**
```
🔍 Inspecting environment: working-test_208a31ec

📋 Basic Information:
  Project Name: working-test
  Hash: working-test_208a31ec
  Path: /Users/user/.local/share/bumpx/envs/working-test_208a31ec
  Size: 324M
  Created: 5/30/2025, 6:38:08 PM

📦 Installed Packages:
  python.org@3.12.10
  curl.se@8.5.0
  cmake.org@3.28.0

🔧 BIN Binaries:
  python (file, executable)
  curl (file, executable)
  cmake (file, executable)
  ...

🏥 Health Check:
  ✅ Binaries present
  ✅ 3 package(s) installed

Overall Status: ✅ Healthy
```

### Cleaning Up Environments

Automatically clean up unused or failed environments:

```bash
# Preview what would be cleaned
bumpx env:clean --dry-run

# Clean environments older than 30 days (default)
bumpx env:clean

# Clean environments older than 7 days
bumpx env:clean --older-than 7

# Force cleanup without confirmation
bumpx env:clean --force

# Verbose cleanup with details
bumpx env:clean --verbose
```

**Cleanup Criteria:**
- Environments with no binaries (failed installations)
- Environments older than specified days (default: 30)
- Empty or corrupted environment directories

### Removing Specific Environments

Remove individual environments by their hash:

```bash
# Remove with confirmation
bumpx env:remove dummy_6d7cf1d6

# Force removal without confirmation
bumpx env:remove minimal_3a5dc15d --force

# Verbose removal showing details
bumpx env:remove working-test_208a31ec --verbose
```

### Environment Hash Format

bumpx uses human-readable hash identifiers for environments:

**Format:** `{project-name}_{8-char-hex-hash}`

**Examples:**
- `final-project_7db6cf06` - Environment for "final-project"
- `working-test_208a31ec` - Environment for "working-test"
- `my-app_1a2b3c4d` - Environment for "my-app"

**Benefits:**
- **Human-readable** - Easy to identify project ownership
- **Unique** - Hash prevents collisions between similar project names
- **Consistent** - Same project always generates the same hash
- **Manageable** - Much shorter than previous base64 format

**Hash Generation:**
- Project name extracted from directory basename
- Cleaned to be filesystem-safe (alphanumeric, hyphens, underscores)
- 8-character hex hash generated from full project path
- Collision-resistant across different directory structures

## Updating Dependencies

### Automatic Updates

Keep your dependencies up to date with the `env:update` command:

```bash
# Check for available updates
bumpx env:update --check-only

# Preview what would be updated
bumpx env:update --dry-run

# Apply updates interactively
bumpx env:update

# Apply updates without confirmation
bumpx env:update --force
```

The update command:
- **Checks latest versions** from pkgx and GitHub (for Bun)
- **Preserves version constraints** (^, ~, >=, etc.)
- **Shows clear diff** of what will change
- **Supports dry-run mode** for safe previewing
- **Updates dependencies.yaml** automatically

**Example output:**
```
🔄 Checking for package updates...

📋 Found dependency file: dependencies.yaml
📦 Found 11 dependencies to check

🔍 Checking bun.sh...
  ✅ Up to date: 1.2.15
🔍 Checking nodejs.org...
  📈 Update available: 22.11.0 → 24.0.1
🔍 Checking zlib.net...
  📈 Update available: 1.2.13 → 1.3.1

📋 Found 2 update(s) available:

📦 nodejs.org
    Current: ^22.11.0
    Latest:  ^24.0.1

📦 zlib.net
    Current: ^1.2.13
    Latest:  ^1.3.1

🤔 Apply 2 update(s)? (y/N):
```

After updating, run `bumpx dev:on` to activate the updated environment.

## Bootstrap Setup

For first-time setup or fresh installations, use the bootstrap command:

### Quick Setup

Get everything you need with one command:

```bash
# Install all essential tools (defaults to /usr/local)
bumpx bootstrap

# Verbose bootstrap showing all operations
bumpx bootstrap --verbose

# Force reinstall everything
bumpx bootstrap --force
```

### Customized Bootstrap

Control what gets installed:

```bash
# Skip specific components
bumpx bootstrap --skip-pkgx
bumpx bootstrap --skip-bun
bumpx bootstrap --skip-shell-integration

# Custom installation path (override default /usr/local)
bumpx bootstrap --path ~/.local

# Disable automatic PATH modification
bumpx bootstrap --no-auto-path
```

## Complete System Cleanup

For complete removal of bumpx and all installed packages:

```bash
# Remove everything with confirmation
bumpx uninstall

# Preview what would be removed
bumpx uninstall --dry-run

# Remove everything without prompts
bumpx uninstall --force

# Remove only packages but keep shell integration
bumpx uninstall --keep-shell-integration

# Remove only shell integration but keep packages
bumpx uninstall --keep-packages
```

The `uninstall` command removes:
- All installed packages and their files
- Installation directories (`bin/`, `sbin/`, `pkgs/`)
- Shell integration from `.zshrc`, `.bashrc`, etc.
- Shim directories
- Project-specific environment directories
- Provides guidance for manual PATH cleanup

## Creating Shims

Shims are lightweight executable scripts that point to the actual binaries. They allow you to run commands without having to modify your PATH for each package:

```bash
# Create shims for a package
bumpx shim node

# Create shims with a custom path
bumpx shim --path ~/bin typescript
```

## Installing the Dev Package

The `dev` command provides a convenient way to install the `dev` package, which enables development-aware environments:

```bash
# Install dev
bumpx dev

# Force reinstall
bumpx dev --force

# Specify installation path
bumpx dev --path ~/bin
```

## Installing pkgx

If you don't have pkgx installed, bumpx can install it for you:

```bash
# Install pkgx
bumpx pkgx

# Force reinstall
bumpx pkgx --force
```

## Installing Bun

bumpx provides a dedicated command for installing Bun directly from GitHub releases:

```bash
# Install latest Bun version
bumpx bun

# Install specific version
bumpx bun --version 1.0.0

# Specify installation path
bumpx bun --path ~/bin
```

The `bun` command automatically detects your platform, downloads the appropriate binary, and adds it to your PATH.

## Installing Zsh

bumpx provides a dedicated command for installing the Zsh shell:

```bash
# Install zsh
bumpx zsh

# Force reinstall
bumpx zsh --force

# Specify installation path
bumpx zsh --path ~/bin
```

After installation, bumpx provides instructions for making zsh your default shell:

```bash
# Make zsh your default shell
chsh -s /path/to/installed/zsh
```

## Managing Auto-updates

Control how pkgx handles updates:

```bash
# Check current auto-update status
bumpx autoupdate

# Enable auto-updates
bumpx autoupdate:enable

# Disable auto-updates
bumpx autoupdate:disable
```

## Listing Installed Packages

View what packages are currently installed:

```bash
# List all installed packages
bumpx list

# Or use the shorthand
bumpx ls
```

## Common Options

Most commands support these options:

| Option | Description |
|--------|-------------|
| `--verbose` | Enable detailed logging |
| `--path` | Specify installation/shim path |
| `--system` | Install to /usr/local (same as default behavior) |
| `--force` | Force reinstall/removal even if already installed/not found |
| `--dry-run` | Preview changes without actually performing them |
| `--no-auto-path` | Don't automatically add to PATH |
| `--sudo` | Use sudo for installation (if needed) |
| `--quiet` | Suppress status messages |

## Package Management Best Practices

### Using Environment Isolation

bumpx automatically provides environment isolation for each project:

```bash
# Each project gets its own environment
cd project-a/    # → Uses node@20, python@3.11
cd ../project-b/ # → Uses node@22, python@3.12
```

### Choosing Between Remove and Uninstall

- Use `remove` when you want to uninstall specific packages while keeping your bumpx setup
- Use `uninstall` when you want to completely remove bumpx and start fresh

### Using Dry-Run Mode

Always preview major changes before executing them:

```bash
# Preview package removal
bumpx remove python --dry-run

# Preview complete system cleanup
bumpx uninstall --dry-run

# Preview environment setup
bumpx dev:dump --dryrun
```

### Version Management

Remove specific versions while keeping others:

```bash
# List installed packages to see versions
bumpx list

# Remove only a specific version
bumpx remove node@20

# Keep node@22 installed
```

## Using PATH Integration

By default, bumpx automatically adds shim directories to your PATH. You can disable this behavior:

```bash
bumpx shim node --no-auto-path
```

## Working with Dependencies

### Dependency File Formats

bumpx supports multiple dependency file formats:

```yaml
# dependencies.yaml
dependencies:
  - node@22
  - python@3.12

env:
  NODE_ENV: development
  API_URL: https://api.example.com
```

### Environment Variables

Set project-specific environment variables:

```yaml
dependencies:
  - node@22

env:
  NODE_ENV: production
  DATABASE_URL: postgresql://localhost/myapp
  API_KEY: your-api-key-here
```

### Complex Dependencies

Handle complex package specifications:

```yaml
dependencies:
  - gnu.org/wget@^1.21
  - curl.se@~8.0
  - python.org@>=3.11

env:
  PATH_EXTENSION: /custom/bin
  PYTHON_PATH: /opt/custom/python
```

## Getting Help

For detailed information about any command:

```bash
bumpx help
bumpx <command> --help
```

## Troubleshooting

### Environment Not Activating

If automatic environment activation isn't working:

1. Ensure shell integration is set up:
   ```bash
   echo 'eval "$(bumpx dev:shellcode)"' >> ~/.zshrc
   source ~/.zshrc
   ```

2. Check for dependency files in your project directory
3. Verify the dependency file syntax is correct

### Package Installation Failures

If packages fail to install:

1. Check your internet connection
2. Verify the package name and version exist
3. Try with verbose output: `bumpx install --verbose package-name`
4. Check if you have write permissions to the installation directory

### Permission Issues

If you encounter permission errors:

1. Use `--sudo` flag for system-wide installations
2. Install to user directory: `--path ~/.local`
3. Check directory permissions

### Shell Integration Issues

If shell integration isn't working:

1. Verify your shell is supported (bash or zsh)
2. Check that the shell integration code was added correctly
3. Reload your shell configuration
4. Try generating new shell code: `bumpx dev:shellcode`
