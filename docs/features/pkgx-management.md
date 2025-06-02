# pkgx Management

bumpx provides dedicated commands for installing and managing pkgx itself, which is the underlying engine that powers package installation.

## Installing pkgx

If you don't have pkgx installed, bumpx can install it for you:

```bash
bumpx pkgx
```

This will:
1. Check if pkgx is already installed
2. Download and install the latest version of pkgx if needed
3. Set it up in a location that's accessible in your PATH

## Installation Location

By default, pkgx is installed to:
- `/usr/local` if it's writable by the current user
- `~/.local` as a fallback location

You can specify a different installation location:

```bash
bumpx pkgx --path ~/apps
```

## Force Reinstallation

To reinstall or update pkgx even if it's already installed:

```bash
bumpx pkgx --force
```

## Auto-update Configuration

pkgx has its own auto-update mechanism. bumpx provides commands to manage this feature:

Check current auto-update status:

```bash
bumpx autoupdate
```

Enable automatic updates:

```bash
bumpx autoupdate:enable
```

Disable automatic updates:

```bash
bumpx autoupdate:disable
```

## Handling Permissions

When installing to system directories like `/usr/local`, you might need elevated permissions:

```bash
# With auto-sudo enabled (default)
bumpx pkgx

# If auto-sudo is disabled
sudo bumpx pkgx

# Or explicitly use sudo
bumpx pkgx --sudo
```

## How pkgx Installation Works

When you run the pkgx installation command, bumpx:

1. Checks if pkgx is already installed and not forced to reinstall
2. Creates the necessary installation directories
3. Downloads the pkgx installation script from `https://pkgx.sh`
4. Runs the installation script with the specified installation path
5. Verifies the installation

## Automatic Installation

You don't need to explicitly install pkgx before using other bumpx commands. If pkgx is required for an operation but not found, bumpx will install it automatically.

## pkgx Configuration

pkgx stores its configuration in `~/.config/pkgx/config.json`. bumpx can modify this configuration through commands like `autoupdate:enable` and `autoupdate:disable`.

The configuration might look like:

```json
{
  "auto_update": true
}
```

## Troubleshooting

If you encounter issues with pkgx installation:

1. Try running with verbose logging:
   ```bash
   bumpx pkgx --verbose
   ```

2. Check if pkgx is properly installed:
   ```bash
   which pkgx
   pkgx --version
   ```

3. Reinstall pkgx:
   ```bash
   bumpx pkgx --force
   ```
