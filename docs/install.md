# Installation

Installing `bumpx` is simple and straightforward. Choose your preferred package manager to get started with the modern version bumping tool.

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

## Quick Start

After installation, you can immediately start using bumpx:

```sh
# Check current version
bumpx --version

# Basic version bump
bumpx patch

# Version bump with git commit
bumpx minor --commit --tag

# Interactive version selection
bumpx prompt
```

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

## System Requirements

bumpx requires:

- **Node.js 16+** or **Bun 1.0+**
- **Git** (for version control operations)
- A project with a `package.json` file (or other version files)

## Verification

Verify your installation:

```sh
# Check bumpx version
bumpx --version

# Test with dry run
bumpx patch --dry-run

# Check help
bumpx --help
```

## Global vs Local Installation

### Global Installation (Recommended)

Install globally to use bumpx across all your projects:

```sh
npm install -g bumpx
```

Benefits:
- Available in any project directory
- Single installation for all projects
- Easy to update

### Local Installation (Per Project)

Install as a development dependency for project-specific usage:

```sh
npm install --save-dev bumpx
```

Then use with npx or add to package.json scripts:

```sh
# Using npx
npx bumpx patch

# Or add to package.json scripts
{
  "scripts": {
    "release": "bumpx patch --commit --tag --push"
  }
}
```

## Platform Support

bumpx works on all major platforms:

- **macOS** (Intel and Apple Silicon)
- **Linux** (Ubuntu, CentOS, Alpine, etc.)
- **Windows** (Windows 10/11, WSL)

## Updating

Keep bumpx up to date:

```sh
# Update global installation
npm update -g bumpx

# Update local installation
npm update bumpx
```

## Uninstalling

Remove bumpx when no longer needed:

```sh
# Remove global installation
npm uninstall -g bumpx

# Remove local installation
npm uninstall bumpx
```

## Troubleshooting

### Common Issues

**Command not found:**
```sh
# Check if globally installed packages are in PATH
echo $PATH | grep npm

# Reinstall globally
npm install -g bumpx
```

**Permission errors (macOS/Linux):**
```sh
# Use a Node version manager (recommended)
# Or configure npm to use a different directory
npm config set prefix ~/.local
export PATH=~/.local/bin:$PATH
```

**Git not found:**
```sh
# Install Git
# macOS: xcode-select --install
# Ubuntu: sudo apt install git
# Windows: https://git-scm.com/download/win
```

### Getting Help

If you encounter issues:

1. Check the [troubleshooting guide](/advanced/cross-platform)
2. Search [existing issues](https://github.com/stacksjs/bumpx/issues)
3. Create a [new issue](https://github.com/stacksjs/bumpx/issues/new)
4. Join our [Discord community](https://discord.gg/stacksjs)

## Next Steps

After installation, you might want to:

- [Configure bumpx](/config) to customize your setup
- [Learn about basic usage](/usage) to start version bumping
- [Explore Git integration](/features/git-integration) for automated workflows
- [Set up monorepo support](/features/monorepo-support) for multi-package projects
