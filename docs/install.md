# Installation

Installing `bumpx` is easy. You can install it using your package manager of choice, or build it from source.

## Package Managers

Choose your preferred package manager:

::: code-group

```sh [npm]
# Install globally
npm install -g bumpx

# Or install as a development dependency
npm install --save-dev bumpx
```

```sh [bun]
# Install globally
bun add -g bumpx

# Or install as a development dependency
bun add -d bumpx
```

```sh [pnpm]
# Install globally
pnpm add -g bumpx

# Or install as a development dependency
pnpm add -D bumpx
```

```sh [yarn]
# Install globally
yarn global add bumpx

# Or install as a development dependency
yarn add -D bumpx
```

:::

## First-Time Setup

bumpx is designed to "just work" right out of the box! When you run bumpx for the first time, it will automatically detect what's missing and offer to set everything up.

### Automatic Bootstrap

Just run any bumpx command and it will offer to bootstrap automatically:

```sh
# Any command will trigger the welcome screen if needed
./bumpx list
# → Shows welcome message and offers to install pkgx, configure PATH, and set up shell integration

# Or manually run the complete setup
./bumpx bootstrap
```

### Manual Bootstrap

For more control over the setup process:

```sh
# Install everything you need in one command (defaults to /usr/local)
./bumpx bootstrap

# Verbose output showing all operations
./bumpx bootstrap --verbose

# Skip specific components
./bumpx bootstrap --skip-bun --skip-shell-integration

# Custom installation path (override default /usr/local)
./bumpx bootstrap --path ~/.local

# Force reinstall everything
./bumpx bootstrap --force
```

The bootstrap command will:
- ✅ Install pkgx (package manager)
- ✅ Install Bun (JavaScript runtime)
- ✅ Configure your PATH
- ✅ Set up shell integration for auto-activation
- ✅ Provide clear next steps

## From Source

To build and install from source:

```sh
# Clone the repository
git clone https://github.com/stacksjs/bumpx.git
cd bumpx

# Install dependencies
bun install

# Build the project
bun run build

# Link for global usage
bun link
```

## Dependencies

bumpx requires the following:

- Node.js 16+ or Bun 1.0+
- pkgx (will be automatically installed if not present)

## Verifying Installation

After installation, you can verify that bumpx is installed correctly by running:

```sh
bumpx version
```

You should see the current version of bumpx displayed in your terminal.

## Post-Installation

### Shell Integration

If you didn't use the bootstrap command, you can manually set up shell integration:

```sh
# Add shell integration to your shell config
echo 'eval "$(bumpx dev:shellcode)"' >> ~/.zshrc

# Or for bash
echo 'eval "$(bumpx dev:shellcode)"' >> ~/.bashrc

# Reload your shell
source ~/.zshrc  # or ~/.bashrc
```

### PATH Configuration

Ensure the installation directories are in your PATH:

```sh
# Check if bumpx directories are in PATH
echo $PATH | grep -E "(\.local/bin|\.local/sbin)"

# If not, the bootstrap command will add them automatically
./bumpx bootstrap
```

## Uninstalling

If you need to completely remove bumpx:

```sh
# Remove everything (with confirmation)
bumpx uninstall

# Preview what would be removed
bumpx uninstall --dry-run

# Force removal without prompts
bumpx uninstall --force

# Keep packages but remove shell integration
bumpx uninstall --keep-packages
```

## Next Steps

After installation, you might want to:

- [Configure bumpx](/config) to customize your setup
- [Learn about basic usage](/usage) to start managing packages
- [Set up package management](/features/package-management) for your development workflow
