# Zsh Installation

bumpx provides a dedicated command for installing the Zsh shell, making it easy to get a modern shell environment set up on any system.

## Quick Start

Install zsh with a single command:

```bash
bumpx zsh
```

This will:
1. Ensure pkgx is installed (installing it if necessary)
2. Install the latest version of zsh through pkgx
3. Add the installation directory to your PATH
4. Provide instructions for making zsh your default shell

## Installation Options

### Basic Installation

```bash
# Install zsh with default settings
bumpx zsh
```

### Custom Installation Path

```bash
# Install to a specific directory
bumpx zsh --path ~/my-shell

# Install to a system directory
bumpx zsh --path /usr/local
```

### Force Reinstallation

```bash
# Force reinstall even if zsh is already installed
bumpx zsh --force
```

### Disable Auto-PATH

```bash
# Install without automatically adding to PATH
bumpx zsh --no-auto-path
```

### Verbose Output

```bash
# See detailed installation information
bumpx zsh --verbose
```

## Making Zsh Your Default Shell

After installation, you'll want to make zsh your default shell. bumpx provides helpful instructions after installation:

### Using the Installed Zsh

```bash
# Find the path to your installed zsh
which zsh

# Make it your default shell (replace with actual path)
chsh -s /path/to/installed/bin/zsh
```

### Using System Zsh

If you prefer to use the system's zsh (if available):

```bash
chsh -s /bin/zsh
```

## Verification

After installation and shell change, verify everything is working:

```bash
# Check zsh version
zsh --version

# Check your current shell
echo $SHELL

# Start a new zsh session
zsh
```

## Configuration

Once zsh is installed and set as your default shell, you might want to:

1. **Install a framework** like Oh My Zsh or Prezto
2. **Configure your `.zshrc`** file
3. **Install plugins** for enhanced functionality

### Oh My Zsh Installation

```bash
# Install Oh My Zsh (after zsh is your default shell)
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

## Troubleshooting

### Permission Issues

If you encounter permission issues:

```bash
# Use sudo if installing to system directories
sudo bumpx zsh --path /usr/local
```

### PATH Issues

If zsh isn't found after installation:

```bash
# Check if the bin directory is in your PATH
echo $PATH

# Manually add to PATH if needed
export PATH="/path/to/zsh/bin:$PATH"

# Add to your shell configuration permanently
echo 'export PATH="/path/to/zsh/bin:$PATH"' >> ~/.bashrc
```

### Shell Change Issues

If `chsh` doesn't work:

1. Make sure the zsh path is in `/etc/shells`:
   ```bash
   # Add your zsh path to allowed shells
   echo "/path/to/zsh/bin/zsh" | sudo tee -a /etc/shells
   ```

2. Try changing shell as root:
   ```bash
   sudo chsh -s /path/to/zsh/bin/zsh $USER
   ```

## Comparison with Other Installation Methods

| Method | Pros | Cons |
|--------|------|------|
| **bumpx** | Simple, cross-platform, automatic PATH management | Requires pkgx |
| **Package Manager** | System integration | Platform-specific, may need sudo |
| **From Source** | Latest features | Complex, time-consuming |

## Advanced Usage

### Multiple Zsh Versions

You can install zsh to different paths for testing:

```bash
# Install stable version
bumpx zsh --path ~/zsh-stable

# Install to another location for testing
bumpx zsh --path ~/zsh-test --force
```

### Integration with Development Environments

Zsh works great with bumpx's dev-aware installations:

```bash
# Install dev package for project-specific environments
bumpx dev

# Use zsh in your development workflow
cd your-project
dev .
```
