# Package Management

bumpx provides comprehensive package management capabilities with support for multiple installation strategies and intelligent path handling. This guide covers all aspects of package management.

## Basic Installation

Install packages using the `install` command:

```bash
# Install a single package
bumpx install node@22

# Install multiple packages
bumpx install python@3.12 go@1.21

# Short alias
bumpx i node
```

## Installation Locations

bumpx supports flexible installation targeting:

### Automatic Location Detection

By default, bumpx automatically selects the best installation location:

```bash
# Installs to /usr/local if writable, ~/.local otherwise
bumpx install node@22
```

### System-Wide Installation

The default behavior already installs to `/usr/local` for system-wide availability:

```bash
# Default installation (already system-wide)
bumpx install node@22

# Explicit system flag (redundant, same as above)
bumpx install node@22 --system

# Explicit path (equivalent to default when /usr/local is writable)
bumpx install node@22 --path /usr/local
```

**Permission Handling**: When installing to `/usr/local`:
- Automatically detects permission requirements
- Prompts for sudo authorization in interactive mode
- Provides clear alternatives if sudo is declined
- Handles non-interactive environments gracefully

### User-Local Installation

Install packages to user-specific directories:

```bash
# Force user-local installation
bumpx install node@22 --path ~/.local

# Alternative user directory
bumpx install node@22 --path ~/tools
```

### Custom Installation Paths

Install to any directory:

```bash
# Custom installation directory
bumpx install node@22 --path /opt/development

# Project-specific installation
bumpx install node@22 --path ./tools
```

## Installation Options

Customize installation behavior with various options:

```bash
# Verbose installation with detailed output
bumpx install --verbose node@22

# Default installation (already system-wide to /usr/local)
bumpx install python@3.12

# Custom installation path
bumpx install --path ~/tools go@1.21

# Force reinstallation
bumpx install --force node@22

# Install without automatically adding to PATH
bumpx install --no-auto-path typescript
```

### Smart Installation

Use smart installation for automatic fallback to system package managers:

```bash
# Try pkgx first, fallback to brew/apt if needed
bumpx smart-install node python

# Disable fallback behavior
bumpx smart-install --no-fallback go
```

## Package Removal

### Removing Specific Packages

Remove individual packages while keeping your bumpx setup intact:

```bash
# Remove a single package
bumpx remove python

# Remove multiple packages at once
bumpx remove node python ruby

# Remove specific versions
bumpx remove node@20
bumpx remove python.org@3.10.17

# Remove with aliases
bumpx rm node
bumpx uninstall-package python
```

### Removal Options

Control removal behavior with various options:

```bash
# Preview what would be removed (recommended)
bumpx remove python --dry-run

# Remove without confirmation prompts
bumpx remove python --force

# Verbose output showing all removed files
bumpx remove python --verbose

# Remove from specific installation path
bumpx remove --path ~/my-tools python
```

### What Gets Removed

The `remove` command intelligently identifies and removes:

- **Binaries**: Files in `bin/` and `sbin/` directories
- **Package directories**: Complete package installation directories
- **Symlinks**: Links pointing to the removed package
- **Shims**: Executable shims created for the package
- **Dependencies**: Package-specific files and configurations

### Safe Removal Process

bumpx ensures safe package removal through:

1. **Package detection**: Finds all versions and files for the specified package
2. **Confirmation prompts**: Asks for confirmation before removal (unless `--force`)
3. **Dry-run mode**: Preview changes with `--dry-run` before actual removal
4. **Detailed reporting**: Shows exactly what was removed, failed, or not found
5. **Selective matching**: Handles both exact matches and pattern matching

## Complete System Cleanup

### Full Uninstallation

Remove bumpx entirely with the `uninstall` command:

```bash
# Remove everything with confirmation
bumpx uninstall

# Preview complete removal
bumpx uninstall --dry-run

# Remove without prompts
bumpx uninstall --force
```

### Selective Cleanup

Choose what to remove with selective options:

```bash
# Remove only packages, keep shell integration
bumpx uninstall --keep-shell-integration

# Remove only shell integration, keep packages
bumpx uninstall --keep-packages

# Verbose cleanup showing all operations
bumpx uninstall --verbose
```

### Complete Cleanup Process

The `uninstall` command removes:

- **All packages**: Every package installed by bumpx
- **Installation directories**: `bin/`, `sbin/`, `pkgs/` directories
- **Shell integration**: Removes lines from `.zshrc`, `.bashrc`, etc.
- **Shim directories**: All created shim directories
- **Configuration**: Provides guidance for manual PATH cleanup

## Bootstrap Setup

### Quick Setup

Get everything you need with one command:

```bash
# Install all essential tools
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

# Custom installation path
bumpx bootstrap --path ~/.local

# Disable automatic PATH modification
bumpx bootstrap --no-auto-path
```

### Bootstrap Components

The bootstrap process installs:

- **pkgx**: Core package manager
- **Bun**: JavaScript runtime
- **PATH setup**: Configures both `bin/` and `sbin/` directories
- **Shell integration**: Sets up auto-activation hooks
- **Progress reporting**: Shows success/failure for each component

## Package Listing

### View Installed Packages

See what's currently installed:

```bash
# List all packages
bumpx list

# Shorthand
bumpx ls

# Verbose listing with paths
bumpx list --verbose

# List from specific path
bumpx list --path ~/my-tools
```

## Version Management

### Handling Multiple Versions

bumpx supports multiple versions of the same package:

```bash
# Install multiple versions
bumpx install node@20 node@22

# List to see all versions
bumpx list

# Remove specific version
bumpx remove node@20

# Keep other versions intact
```

### Version Specification

Support for various version formats:

```bash
# Exact version
bumpx install node@22.1.0

# Major version
bumpx install python@3

# Version with package domain
bumpx install python.org@3.12.0
```

## Best Practices

### Safe Package Management

1. **Always dry-run first**: Use `--dry-run` for major operations
2. **List before removing**: Check `bumpx list` to see what's installed
3. **Use specific versions**: Specify versions to avoid conflicts
4. **Regular cleanup**: Remove unused packages to save space

### Choosing the Right Command

- **`remove`**: For removing specific packages while keeping bumpx
- **`uninstall`**: For complete system cleanup and fresh start
- **`bootstrap`**: For initial setup or recovering from issues
- **`list`**: To audit what's currently installed

### Error Recovery

If something goes wrong:

```bash
# Check what's still installed
bumpx list

# Try to clean up broken installations
bumpx uninstall --dry-run

# Fresh start with bootstrap
bumpx bootstrap --force
```

## Troubleshooting

### Common Issues

**Package not found during removal**:
```bash
# Check exact package names
bumpx list

# Use verbose mode for details
bumpx remove package-name --verbose
```

**Permission errors**:
```bash
# Use sudo if needed
sudo bumpx remove package-name

# Or install to user directory
bumpx install --path ~/.local package-name
```

**PATH issues after removal**:
```bash
# Check PATH in new shell
echo $PATH

# Restart shell or source config
source ~/.zshrc
```

### Getting Help

For detailed help with any command:

```bash
bumpx help
bumpx remove --help
bumpx uninstall --help
bumpx bootstrap --help
```
