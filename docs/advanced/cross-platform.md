# Cross-Platform Compatibility

bumpx is designed to work seamlessly across different operating systems. This guide covers platform-specific considerations, differences, and best practices.

## Platform Support

bumpx officially supports:

- **macOS** (Intel and Apple Silicon)
- **Linux** (Ubuntu, CentOS, Alpine, etc.)
- **Windows** (Windows 10/11, Windows Server)

### Runtime Requirements

All platforms require:
- Node.js 16+ or Bun 1.0+
- Git (for version control operations)
- NPM, Yarn, or PNPM (for dependency installation)

## Installation Differences

### macOS

Standard installation using Homebrew or npm:

```bash
# Via Homebrew (recommended)
brew install bumpx

# Via npm
npm install -g bumpx

# Via Bun
bun add -g bumpx
```

### Linux

Installation varies by distribution:

```bash
# Ubuntu/Debian
curl -fsSL https://bun.sh/install | bash
npm install -g bumpx

# CentOS/RHEL
dnf install nodejs npm
npm install -g bumpx

# Alpine Linux
apk add nodejs npm
npm install -g bumpx

# Arch Linux
pacman -S nodejs npm
npm install -g bumpx
```

### Windows

Multiple installation options:

```powershell
# Via npm (requires Node.js)
npm install -g bumpx

# Via Chocolatey
choco install bumpx

# Via Scoop
scoop install bumpx

# Via winget
winget install stacksjs.bumpx
```

## File System Differences

### Path Separators

bumpx handles path differences automatically:

```bash
# Works on all platforms
bumpx patch --files "packages/*/package.json"

# Platform-specific examples (handled internally):
# Windows: packages\core\package.json
# Unix:    packages/core/package.json
```

### Line Endings

bumpx preserves existing line endings:

```bash
# Configure Git to handle line endings properly
git config core.autocrlf true    # Windows
git config core.autocrlf input   # macOS/Linux

# bumpx respects your Git configuration
bumpx patch --commit
```

### File Permissions

Unix-like systems vs. Windows:

```bash
# Unix-like systems (macOS/Linux)
chmod +x scripts/release.sh
./scripts/release.sh

# Windows PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\release.ps1
```

## Shell and Command Line

### Shell Compatibility

bumpx works with various shells:

**macOS/Linux:**
- Bash
- Zsh (default on macOS)
- Fish
- Dash

**Windows:**
- PowerShell (recommended)
- Command Prompt
- Git Bash
- WSL (Windows Subsystem for Linux)

### Shell Configuration

Set up shell integration:

```bash
# Bash (.bashrc)
echo 'eval "$(bumpx completion bash)"' >> ~/.bashrc

# Zsh (.zshrc)
echo 'eval "$(bumpx completion zsh)"' >> ~/.zshrc

# Fish (config.fish)
echo 'bumpx completion fish | source' >> ~/.config/fish/config.fish
```

**Windows PowerShell:**
```powershell
# Add to PowerShell profile
Add-Content $PROFILE 'Invoke-Expression (bumpx completion powershell)'
```

## Git Integration

### Git Configuration

Configure Git consistently across platforms:

```bash
# Essential Git settings (all platforms)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main

# Platform-specific line ending handling
# Windows
git config --global core.autocrlf true

# macOS/Linux
git config --global core.autocrlf input
```

### SSH vs HTTPS

Platform considerations for Git authentication:

**SSH (recommended for all platforms):**
```bash
# Generate SSH key (all platforms)
ssh-keygen -t ed25519 -C "your.email@example.com"

# Windows (PowerShell)
Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard

# macOS
pbcopy < ~/.ssh/id_ed25519.pub

# Linux
xclip -selection clipboard < ~/.ssh/id_ed25519.pub
```

**HTTPS with tokens:**
```bash
# Configure credential storage
git config --global credential.helper store    # Linux
git config --global credential.helper osxkeychain  # macOS
git config --global credential.helper manager  # Windows
```

## Environment Variables

### Setting Environment Variables

Cross-platform environment configuration:

**Unix-like systems (.bashrc, .zshrc):**
```bash
export BUMPX_COMMIT=true
export BUMPX_TAG=true
export BUMPX_PUSH=false
```

**Windows (PowerShell profile):**
```powershell
$env:BUMPX_COMMIT = "true"
$env:BUMPX_TAG = "true"
$env:BUMPX_PUSH = "false"
```

**Windows (Command Prompt):**
```cmd
set BUMPX_COMMIT=true
set BUMPX_TAG=true
set BUMPX_PUSH=false
```

### Persistent Environment Variables

**Windows (System Properties):**
```powershell
# Via PowerShell (requires admin)
[System.Environment]::SetEnvironmentVariable("BUMPX_COMMIT", "true", "User")

# Via GUI: System Properties > Environment Variables
```

**macOS/Linux (.bashrc, .zshrc, .profile):**
```bash
# Add to shell profile
echo 'export BUMPX_COMMIT=true' >> ~/.bashrc
source ~/.bashrc
```

## CI/CD Platform Differences

### GitHub Actions

Works identically across platforms:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [18, 20, 22]

runs-on: ${{ matrix.os }}
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
  - run: npm ci
  - run: bumpx patch --dry-run # Test on all platforms
```

### Platform-Specific CI

**Windows-specific considerations:**
```yaml
# GitHub Actions - Windows
- name: Setup Git (Windows)
  if: runner.os == 'Windows'
  run: |
    git config --global core.autocrlf true
    git config --global core.longpaths true
```

**macOS-specific considerations:**
```yaml
# GitHub Actions - macOS
- name: Setup Git (macOS)
  if: runner.os == 'macOS'
  run: |
    git config --global core.autocrlf input
```

## Package Managers

### Bun

Native cross-platform support:

```bash
# All platforms
bun add -g bumpx
bun run release
```

## Scripts and Automation

### Cross-Platform Scripts

Create scripts that work everywhere:

**package.json (recommended):**
```json
{
  "scripts": {
    "release": "bumpx patch --commit --tag --push",
    "release:major": "bumpx major --commit --tag --push",
    "release:minor": "bumpx minor --commit --tag --push"
  }
}
```

**Cross-platform shell script:**
```bash
#!/bin/bash
# scripts/release.sh - Works on Unix and Git Bash on Windows

set -e

echo "Starting release process..."

# Platform detection
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "Detected Windows (Git Bash)"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected macOS"
else
    echo "Detected Linux"
fi

# Run tests
npm test

# Create release
bumpx patch --commit --tag --push

echo "Release completed!"
```

**Windows PowerShell script:**
```powershell
# scripts/release.ps1
param(
    [string]$ReleaseType = "patch"
)

Write-Host "Starting release process..." -ForegroundColor Green

try {
    # Run tests
    npm test
    if ($LASTEXITCODE -ne 0) { throw "Tests failed" }

    # Create release
    & bumpx $ReleaseType --commit --tag --push
    if ($LASTEXITCODE -ne 0) { throw "Release failed" }

    Write-Host "Release completed!" -ForegroundColor Green
}
catch {
    Write-Host "Release failed: $_" -ForegroundColor Red
    exit 1
}
```

## Path and File Handling

### Configuration Files

bumpx looks for configuration files in standard locations:

```bash
# All platforms - bumpx checks these locations in order:
# 1. ./bumpx.config.ts
# 2. ./bumpx.config.js
# 3. ./bumpx.config.mjs
# 4. ./bumpx.config.cjs
# 5. ./.config/bumpx.*
# 6. ./config/bumpx.*
# 7. ./package.json (bumpx section)
# 8. ~/.config/bumpx.* (user home directory)
```

**Home directory resolution:**
```bash
# Automatically resolved on all platforms:
# Windows: C:\Users\username\.config\bumpx.ts
# macOS:   /Users/username/.config/bumpx.ts
# Linux:   /home/username/.config/bumpx.ts
```

### Glob Patterns

Cross-platform file matching:

```bash
# These patterns work on all platforms:
bumpx patch --files "packages/*/package.json"
bumpx patch --files "apps/**/package.json"
bumpx patch --files "{packages,apps}/*/package.json"

# Avoid platform-specific separators in patterns
# Good: "packages/*/package.json"
# Bad:  "packages\*\package.json"  # Windows-only
```

## Performance Considerations

### Platform Performance

Performance characteristics by platform:

**Windows:**
- File I/O may be slower due to antivirus scanning
- Use SSD for best performance
- Consider excluding `node_modules` from antivirus scans

**macOS:**
- Generally fast across all operations
- Apple Silicon Macs show excellent performance

**Linux:**
- Typically fastest for I/O operations
- Varies by distribution and system configuration

### Optimization Tips

**Windows-specific optimizations:**
```bash
# Exclude from Windows Defender
Add-MpPreference -ExclusionPath "C:\path\to\your\project\node_modules"

# Use npm cache on SSD
npm config set cache C:\npm-cache
```

**All platforms:**
```bash
# Use local npm cache
npm config set cache ./.npm-cache

# Enable parallel operations
npm config set maxsockets 50
```

## Common Platform Issues

### Windows-Specific Issues

**Long path support:**
```powershell
# Enable long paths (Windows 10+)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

# Git long path support
git config --global core.longpaths true
```

**Execution policy:**
```powershell
# Allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Line ending issues:**
```bash
# Configure Git properly
git config --global core.autocrlf true
git config --global core.safecrlf warn
```

### macOS-Specific Issues

**Gatekeeper:**
```bash
# If bumpx is blocked by Gatekeeper
xattr -d com.apple.quarantine /usr/local/bin/bumpx
```

**Rosetta 2 (Apple Silicon):**
```bash
# Force x86_64 mode if needed
arch -x86_64 npm install -g bumpx
```

### Linux-Specific Issues

**Permission issues:**
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
```

**Missing dependencies:**
```bash
# Ubuntu/Debian
apt-get update && apt-get install -y git nodejs npm

# CentOS/RHEL
yum install -y git nodejs npm

# Alpine
apk add --no-cache git nodejs npm
```

## Best Practices

### Cross-Platform Development

1. **Use npm scripts:** They work consistently across platforms
2. **Avoid hardcoded paths:** Use relative paths and glob patterns
3. **Test on multiple platforms:** Use CI to verify cross-platform compatibility
4. **Use consistent line endings:** Configure Git properly
5. **Handle permissions properly:** Consider Unix vs. Windows differences

### Configuration Management

**Package.json configuration:**
```json
{
  "scripts": {
    "prerelease": "bun test && bun run build",
    "release": "bumpx patch --commit --tag --push",
    "postrelease": "bun publish"
  },
  "bumpx": {
    "commit": true,
    "tag": true,
    "push": false,
    "message": "chore: release v%s"
  }
}
```

**Or TypeScript configuration:**
```typescript
// bumpx.config.ts
export default {
  commit: true,
  tag: true,
  push: false,
  message: 'chore: release v%s'
}
```

### CI/CD Best Practices

```yaml
# Test on multiple platforms
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    include:
      - os: windows-latest
        script-ext: .ps1
      - os: ubuntu-latest
        script-ext: .sh
      - os: macos-latest
        script-ext: .sh
```

## Troubleshooting

### Platform Detection

Debug platform-specific issues:

```javascript
// Debug script to check platform details
console.log('Platform:', process.platform)
console.log('Architecture:', process.arch)
console.log('Node version:', process.version)
console.log('Home directory:', require('node:os').homedir())
console.log('Temp directory:', require('node:os').tmpdir())
```

### Common Solutions

**Path issues:**
```bash
# Check PATH
echo $PATH        # Unix
echo $env:PATH    # PowerShell

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"  # Unix
$env:PATH += ";$HOME\.local\bin"      # PowerShell
```

**Git issues:**
```bash
# Check Git configuration
git config --list --show-origin

# Reset Git configuration
git config --global --unset-all core.autocrlf
git config --global core.autocrlf input  # or 'true' on Windows
```

**Permission issues:**
```bash
# Unix: Fix npm permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Windows: Run as administrator
Start-Process powershell -Verb runAs
```
