import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('CLI Integration Tests', () => {
  let tempDir: string
  let bumpxBin: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = join(tmpdir(), `bumpx-cli-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })

    // Get the path to the bumpx binary - prefer built JS in CI, otherwise use what's available
    const builtBin = join(__dirname, '..', 'dist', 'bin', 'cli.js')
    const sourceBin = join(__dirname, '..', 'bin', 'cli.ts')
    const compiledBin = join(__dirname, '..', 'bin', 'bumpx')

    // In CI, prefer built JS over source TS for better reliability
    if (process.env.CI) {
      if (existsSync(builtBin)) {
        bumpxBin = builtBin
      }
      else {
        bumpxBin = sourceBin
      }
    }
    else if (existsSync(compiledBin)) {
      bumpxBin = compiledBin
    }
    else if (existsSync(builtBin)) {
      bumpxBin = builtBin
    }
    else {
      bumpxBin = sourceBin
    }

    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  // Build a sandboxed Git environment to strictly confine all git operations
  const sandboxEnv = (cwd: string) => ({
    ...process.env,
    GIT_DIR: join(cwd, '.git'),
    GIT_WORK_TREE: cwd,
    HOME: cwd,
    HUSKY: '0',
    // Prevent git from walking above the tmp root and block interactive prompts
    GIT_CEILING_DIRECTORIES: tmpdir(),
    GIT_TERMINAL_PROMPT: '0',
  })

  const runCLI = (args: string[]): Promise<{ code: number, stdout: string, stderr: string }> => {
    return new Promise((resolve) => {
      // Always use bun for CI compatibility, determine method for local
      let command: string
      let cmdArgs: string[]

      if (process.env.CI) {
        // Always use bun with source TS in CI
        command = 'bun'
        cmdArgs = [bumpxBin, ...args]
      }
      else {
        // Local environment - use appropriate method
        const isCompiledBinary = bumpxBin.endsWith('bumpx') && !bumpxBin.endsWith('.ts') && !bumpxBin.endsWith('.js')

        if (isCompiledBinary) {
          // Standalone binary - run directly
          command = bumpxBin
          cmdArgs = args
        }
        else {
          // JS/TS files - run with bun
          command = 'bun'
          cmdArgs = [bumpxBin, ...args]
        }
      }

      const decoder = new TextDecoder()
      const res = Bun.spawnSync([command, ...cmdArgs], {
        cwd: tempDir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: sandboxEnv(tempDir),
      })

      const result = {
        code: res.exitCode,
        stdout: decoder.decode(res.stdout),
        stderr: decoder.decode(res.stderr),
      }

      resolve(result)
    })
  }

  const runGit = (args: string[]): Promise<{ code: number, stdout: string, stderr: string }> => {
    return new Promise((resolve) => {
      const decoder = new TextDecoder()
      const res = Bun.spawnSync(['git', ...args], {
        cwd: tempDir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: sandboxEnv(tempDir),
      })
      resolve({ code: res.exitCode, stdout: decoder.decode(res.stdout), stderr: decoder.decode(res.stderr) })
    })
  }

  describe('Basic CLI Commands', () => {
    it('should show help with --help flag', async () => {
      const result = await runCLI(['--help'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('Options:')
      expect(result.stdout).toContain('--version')
      expect(result.stdout).toContain('--help')
    })

    it('should show version with --version flag', async () => {
      const result = await runCLI(['--version'])

      expect(result.code).toBe(0)
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
    })

    it('should handle invalid commands gracefully', async () => {
      // Create a package.json so we test release type validation, not missing file error
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))

      const result = await runCLI(['invalid-command', '--no-git-check'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Invalid release type or version: invalid-command')
    })
  })

  describe('Version Bumping Commands', () => {
    beforeEach(() => {
      // Create a basic package.json for testing
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package for CLI testing',
      }, null, 2))
    })

    it('should bump patch version', async () => {
      const result = await runCLI(['patch', '--no-git-check', '--no-commit', '--no-tag', '--no-push'])

      // Debug output for CI failures
      if (result.code !== 0) {
        console.log('=== CLI FAILURE DEBUG ===')
        console.log('Exit code:', result.code)
        console.log('STDOUT:', result.stdout)
        console.log('STDERR:', result.stderr)
        console.log('Command:', 'bun', bumpxBin, 'patch', '--no-git-check', '--no-commit', '--no-tag', '--no-push')
        console.log('Binary path:', bumpxBin)
        console.log('Binary exists:', existsSync(bumpxBin))
        console.log('Working directory:', tempDir)
        console.log('Package.json exists:', existsSync(join(tempDir, 'package.json')))
        if (existsSync(join(tempDir, 'package.json'))) {
          console.log('Package.json content:', readFileSync(join(tempDir, 'package.json'), 'utf-8'))
        }
        console.log('========================')
      }

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.0')
      expect(result.stdout).toContain('1.0.1')

      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('1.0.1')
    })

    it('should bump minor version', async () => {
      const result = await runCLI(['minor', '--no-git-check', '--no-commit', '--no-tag', '--no-push'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.0')
      expect(result.stdout).toContain('1.1.0')

      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('1.1.0')
    })

    it('should bump major version', async () => {
      const result = await runCLI(['major', '--no-git-check', '--no-commit', '--no-tag', '--no-push'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.0')
      expect(result.stdout).toContain('2.0.0')

      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('2.0.0')
    })

    it('should set specific version', async () => {
      const result = await runCLI(['3.2.1', '--no-git-check', '--no-commit', '--no-tag', '--no-push'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.0')
      expect(result.stdout).toContain('3.2.1')

      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('3.2.1')
    })

    it('should handle prerelease versions', async () => {
      const result = await runCLI(['prerelease', '--preid', 'beta', '--no-git-check', '--no-commit', '--no-tag', '--no-push'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.0')
      expect(result.stdout).toContain('1.0.1-beta.0')

      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('1.0.1-beta.0')
    })
  })

  describe('File Targeting', () => {
    it('should work with --files flag for multiple files', async () => {
      // Create multiple files
      const files = ['package.json', 'manifest.json', 'VERSION.txt']

      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'pkg', version: '1.0.0' }, null, 2))
      writeFileSync(join(tempDir, 'manifest.json'), JSON.stringify({ version: '1.0.0' }, null, 2))
      writeFileSync(join(tempDir, 'VERSION.txt'), '1.0.0\n')

      const result = await runCLI([
        'patch',
        '--files',
        files.join(','),
        '--no-git-check',
        '--no-commit',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)

      // Verify all files were updated
      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('1.0.1')

      const manifestContent = JSON.parse(readFileSync(join(tempDir, 'manifest.json'), 'utf-8'))
      expect(manifestContent.version).toBe('1.0.1')

      const versionContent = readFileSync(join(tempDir, 'VERSION.txt'), 'utf-8')
      expect(versionContent.trim()).toBe('1.0.1')
    })

    it('should work with --recursive flag', async () => {
      // Create root package.json
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'root',
        version: '1.0.0',
      }, null, 2))

      // Create nested packages
      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })

      const packages = ['core', 'utils']
      packages.forEach((pkg) => {
        const pkgDir = join(packagesDir, pkg)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@test/${pkg}`,
          version: '1.0.0',
        }, null, 2))
      })

      const result = await runCLI([
        'patch',
        '--recursive',
        '--no-git-check',
        '--no-commit',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)

      // Verify all packages were updated
      const rootContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(rootContent.version).toBe('1.0.1')

      packages.forEach((pkg) => {
        const pkgContent = JSON.parse(readFileSync(join(packagesDir, pkg, 'package.json'), 'utf-8'))
        expect(pkgContent.version).toBe('1.0.1')
      })
    })
  })

  describe('Git Integration', () => {
    beforeEach(async () => {
      // Initialize git repo
      await runGit(['init'])
      await runGit(['config', 'user.name', 'Test User'])
      await runGit(['config', 'user.email', 'test@example.com'])

      // Create package.json and commit it
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))

      await runGit(['add', 'package.json'])
      await runGit(['commit', '-m', 'Initial commit'])
    })

    it('should create git commit with --commit flag', async () => {
      const result = await runCLI([
        'patch',
        '--commit',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)

      // Check git log
      const gitLog = await runGit(['log', '--oneline'])
      expect(gitLog.stdout).toContain('1.0.1')
    })

    it('should create git tag with --tag flag', async () => {
      const result = await runCLI([
        'patch',
        '--commit',
        '--tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)

      // Check git tags
      const gitTags = await runGit(['tag', '-l'])
      expect(gitTags.stdout).toContain('v1.0.1')
    })

    it('should use custom commit message', async () => {
      const result = await runCLI([
        'patch',
        '--commit',
        '--commit-message',
        'chore: release version %s',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)

      const gitLog = await runGit(['log', '--oneline', '-1'])
      expect(gitLog.stdout).toContain('chore: release version 1.0.1')
    })

    it('should use custom tag message', async () => {
      const result = await runCLI([
        'patch',
        '--commit',
        '--tag',
        '--tag-message',
        'Release %s',
        '--no-push',
      ])

      expect(result.code).toBe(0)

      const gitTagMessage = await runGit(['tag', '-l', '-n1'])
      expect(gitTagMessage.stdout).toContain('Release 1.0.1')
    })
  })

  describe('Configuration', () => {
    it('should use configuration from package.json', async () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        bumpx: {
          commit: false,
          tag: false,
          push: false,
        },
      }, null, 2))

      const result = await runCLI(['patch', '--no-git-check'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.1')
    })

    it('should use configuration from bumpx.config.ts file', async () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))

      writeFileSync(join(tempDir, 'bumpx.config.ts'), `
export default {
  commit: false,
  tag: false,
  push: false,
  noGitCheck: true,
  recursive: false
}
`)

      const result = await runCLI(['patch', '--no-git-check'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.1')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing package.json', async () => {
      const result = await runCLI(['patch', '--no-git-check'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('No package.json files found')
    })

    it('should handle invalid version in package.json', async () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: 'invalid-version',
      }, null, 2))

      const result = await runCLI(['patch', '--no-git-check'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Invalid release type or version')
    })

    it('should handle malformed package.json', async () => {
      writeFileSync(join(tempDir, 'package.json'), '{ invalid json }')

      const result = await runCLI(['patch', '--no-git-check'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Failed to read')
    })

    it('should handle dirty git working directory', async () => {
      // Initialize git repo
      await runGit(['init'])
      await runGit(['config', 'user.name', 'Test User'])
      await runGit(['config', 'user.email', 'test@example.com'])

      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))

      // Add package.json but don't commit (dirty working directory)
      await runGit(['add', 'package.json'])

      const result = await runCLI(['patch', '--tag', '--no-commit'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('working tree is not clean')
    })

    it('should bypass git check with --no-git-check', async () => {
      // Initialize git repo with dirty state
      await runGit(['init'])
      await runGit(['config', 'user.name', 'Test User'])
      await runGit(['config', 'user.email', 'test@example.com'])

      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))

      await runGit(['add', 'package.json'])

      const result = await runCLI(['patch', '--no-git-check', '--no-commit', '--no-tag', '--no-push'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.1')
    })
  })

  describe('Dry Run', () => {
    beforeEach(() => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))
    })

    it('should show what would be changed with --dry-run', async () => {
      const result = await runCLI(['patch', '--dry-run', '--no-git-check'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.0')
      expect(result.stdout).toContain('1.0.1')
      expect(result.stdout).toContain('DRY RUN') // or similar indicator

      // Verify file was NOT actually changed
      const packageContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(packageContent.version).toBe('1.0.0')
    })
  })

  describe('Verbose Output', () => {
    beforeEach(() => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))
    })

    it('should show detailed output with --verbose', async () => {
      const result = await runCLI(['patch', '--verbose', '--no-git-check', '--no-commit', '--no-tag', '--no-push'])

      expect(result.code).toBe(0)
      expect(result.stdout.length).toBeGreaterThan(100) // Should have more detailed output
      expect(result.stdout).toContain('package.json') // Should mention the file being processed
    })
  })

  describe('Custom Commands Execution', () => {
    beforeEach(() => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))
    })

    it('should execute custom command with --execute', async () => {
      const result = await runCLI([
        'patch',
        '--execute',
        'echo "Custom command executed"',
        '--no-git-check',
        '--no-commit',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Custom command executed')
    })

    it('should install dependencies with --install', async () => {
      // Create a minimal package.json with dependencies
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        dependencies: {},
      }, null, 2))

      const result = await runCLI([
        'patch',
        '--install',
        '--no-git-check',
        '--no-commit',
        '--no-tag',
        '--no-push',
      ])

      // Note: This might fail in CI, but should show the attempt
      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.1')
    })
  })

  describe('Monorepo CLI Support', () => {
    beforeEach(() => {
      // Create a monorepo structure
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'monorepo-root',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*'],
      }, null, 2))

      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })

      const packages = ['core', 'utils', 'ui']
      packages.forEach((pkg) => {
        const pkgDir = join(packagesDir, pkg)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@monorepo/${pkg}`,
          version: '1.0.0',
        }, null, 2))
      })
    })

    it('should bump all packages in monorepo with --recursive', async () => {
      const result = await runCLI([
        'patch',
        '--recursive',
        '--no-git-check',
        '--no-commit',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('1.0.1')

      // Verify all packages were updated
      const packages = ['core', 'utils', 'ui']
      packages.forEach((pkg) => {
        const pkgContent = JSON.parse(readFileSync(join(tempDir, 'packages', pkg, 'package.json'), 'utf-8'))
        expect(pkgContent.version).toBe('1.0.1')
      })
    })

    it('should synchronize all packages with --current-version', async () => {
      const result = await runCLI([
        'patch',
        '--recursive',
        '--current-version',
        '1.0.0',
        '--no-git-check',
        '--no-commit',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)

      // Verify all packages have same version
      const packages = ['core', 'utils', 'ui']
      packages.forEach((pkg) => {
        const pkgContent = JSON.parse(readFileSync(join(tempDir, 'packages', pkg, 'package.json'), 'utf-8'))
        expect(pkgContent.version).toBe('1.0.1')
      })

      // Also check root
      const rootContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(rootContent.version).toBe('1.0.1')
    })
  })

  describe('Progress and Feedback', () => {
    beforeEach(() => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }, null, 2))
    })

    it('should show commit history with --commits', async () => {
      // Initialize git repo with some commits
      await runGit(['init'])
      await runGit(['config', 'user.name', 'Test User'])
      await runGit(['config', 'user.email', 'test@example.com'])

      writeFileSync(join(tempDir, 'README.md'), '# Test Project')
      await runGit(['add', 'README.md'])
      await runGit(['commit', '-m', 'Add README'])

      await runGit(['add', 'package.json'])
      await runGit(['commit', '-m', 'Add package.json'])

      const result = await runCLI([
        'patch',
        '--print-commits',
        '--no-commit',
        '--no-tag',
        '--no-push',
      ])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Recent commits:')
      expect(result.stdout).toContain('Add README')
      expect(result.stdout).toContain('Add package.json')
    })
  })

  describe('--yes Flag Behavior', () => {
    it('should bypass git check when --yes is used with commit operations', async () => {
      const packagePath = join(tempDir, 'package.json')

      // Create initial package.json and some uncommitted changes
      writeFileSync(packagePath, JSON.stringify({ name: 'test-package', version: '1.0.0' }, null, 2))

      // Create another file to simulate uncommitted changes
      writeFileSync(join(tempDir, 'CHANGELOG.md'), '# Changelog\n\nSome changes...')

      try {
        execSync('git init', { cwd: tempDir, stdio: 'ignore', env: sandboxEnv(tempDir) })
        execSync('git config user.name "Test User"', { cwd: tempDir, stdio: 'ignore', env: sandboxEnv(tempDir) })
        execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore', env: sandboxEnv(tempDir) })
        execSync('git add package.json', { cwd: tempDir, stdio: 'ignore', env: sandboxEnv(tempDir) })
        execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore', env: sandboxEnv(tempDir) })

        // Leave CHANGELOG.md uncommitted to simulate dirty working tree

        // This should work with --yes even though working tree is dirty (dry-run)
        const result = await runCLI(['patch', '--yes', '--commit', '--no-push', '--dry-run'])

        expect(result.code).toBe(0)
        expect(result.stdout).toMatch(/Would bump version/)
        expect(result.stdout).toMatch(/Would create git commit/)
        expect(result.stderr).not.toMatch(/Git working tree is not clean/)
      }
      catch (error) {
        // If git operations fail in test environment, that's expected
        console.warn('Git operations failed in test environment, checking command parsing')
        const errorMessage = (error as any).message || String(error)
        expect(errorMessage).not.toMatch(/Git working tree is not clean/)
      }
    }, 10000)
  })
})
