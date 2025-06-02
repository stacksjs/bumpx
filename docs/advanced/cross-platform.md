# Cross-platform Compatibility

bumpx is designed to work seamlessly across different operating systems. This guide explains how bumpx handles platform-specific nuances and how to optimize your usage for cross-platform scenarios.

## Platform Detection

bumpx automatically detects the operating system it's running on and adjusts its behavior accordingly:

```typescript
// Example of how bumpx detects platforms internally
import { platform } from 'node:os'

const isWindows = platform() === 'win32'
const isMacOS = platform() === 'darwin'
const isLinux = platform() === 'linux'
```

## Path Handling

### Windows Path Differences

On Windows, paths use backslashes (`\`) rather than forward slashes (`/`). bumpx normalizes paths internally:

```typescript
// Example of path normalization
import path from 'node:path'

const normalizedPath = path.normalize('/usr/local/bin')
// On Windows, this becomes something like 'C:\usr\local\bin'
```

### Home Directory Resolution

bumpx resolves the `~` symbol to the user's home directory across all platforms:

```typescript
// bumpx's internal approach
const homePath = process.env.HOME || process.env.USERPROFILE || '~'
```

## Shell Integration

Each platform uses different shells by default:

- **Windows**: PowerShell or CMD
- **macOS**: Zsh (newer versions) or Bash (older versions)
- **Linux**: Bash, Zsh, or others

bumpx adapts its PATH modification strategies accordingly.

## File System Permissions

Permission handling differs by platform:

- **Unix-like Systems** (macOS, Linux): Uses Unix permissions (rwx)
- **Windows**: Uses ACLs (Access Control Lists)

When creating shims, bumpx sets the appropriate permissions:

```typescript
// On Unix-like systems
fs.chmodSync(shimPath, 0o755) // Makes file executable

// On Windows
// No explicit chmod needed; Windows handles differently
```

## Sudo Handling

Elevated privileges are required for certain operations, and the approach varies by platform:

- **Unix-like Systems**: Uses `sudo`
- **Windows**: Requires running as Administrator

bumpx's auto-sudo feature automatically adapts to the platform.

## Platform-specific Example: PATH Management

### macOS/Linux

```bash
# Add to PATH on Unix-like systems
echo 'export PATH="~/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Windows (PowerShell)

```powershell
# Add to PATH on Windows
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$newPath = "$env:USERPROFILE\.local\bin;" + $currentPath
[Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
```

## Executable Detection

Different platforms use different file extensions for executables:

- **Unix-like Systems**: No extension required (permissions matter)
- **Windows**: `.exe`, `.bat`, `.cmd`, etc.

bumpx handles these differences when creating and detecting executables.

## Platform-specific Installation Paths

Default installation paths vary by platform:

- **macOS**: `/usr/local` (traditional) or `/opt/homebrew` (newer systems)
- **Linux**: `/usr/local` (system-wide) or `~/.local` (user-specific)
- **Windows**: `%LOCALAPPDATA%` or `%PROGRAMFILES%`

## Integration with pkgx

pkgx itself is cross-platform, and bumpx leverages this to provide a consistent experience across operating systems.

## Testing Across Platforms

When developing with bumpx, it's good practice to test on multiple platforms:

```bash
# Basic testing on Unix-like systems
bumpx install node@22
node --version

# Verify shim creation
ls -la ~/.local/bin/node
```

```powershell
# Basic testing on Windows
bumpx install node@22
node --version

# Verify shim creation
dir $env:USERPROFILE\.local\bin\node.exe
```

## Cross-platform CI/CD Integration

For CI/CD pipelines, you can use bumpx consistently across platforms:

```yaml
# Example GitHub Actions workflow
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v2
      - name: Install bumpx
        run: npm install -g bumpx
      - name: Install dependencies with bumpx
        run: bumpx install node@22 python@3.12
```
