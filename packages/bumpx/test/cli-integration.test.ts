import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { spawn } from 'node:child_process'
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

    // In CI, prioritize built JS version; locally prefer compiled binary for speed
    if (process.env.CI && existsSync(builtBin)) {
      bumpxBin = builtBin
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

  const runCLI = (args: string[]): Promise<{ code: number, stdout: string, stderr: string }> => {
    return new Promise((resolve) => {
      // Determine execution method based on binary type
      const isCompiledBinary = bumpxBin.endsWith('bumpx') && !bumpxBin.endsWith('.ts') && !bumpxBin.endsWith('.js')
      const isBuiltJS = bumpxBin.endsWith('.js')
      const isSourceTS = bumpxBin.endsWith('.ts')

      let command: string
      let cmdArgs: string[]

      if (isCompiledBinary) {
        // Standalone binary - run directly
        command = bumpxBin
        cmdArgs = args
      }
      else if (isBuiltJS) {
        // Built JS - run with node
        command = 'node'
        cmdArgs = [bumpxBin, ...args]
      }
      else if (isSourceTS) {
        // Source TS - run with bun
        command = 'bun'
        cmdArgs = [bumpxBin, ...args]
      }
      else {
        // Default fallback
        command = 'bun'
        cmdArgs = [bumpxBin, ...args]
      }

      const child = spawn(command, cmdArgs, {
        cwd: tempDir,
        stdio: 'pipe',
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr })
      })
    })
  }

  describe('Basic CLI Commands', () => {
    it('should show help when no arguments provided', async () => {
      const result = await runCLI([])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('bumpx')
    })

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

  describe('Error Handling', () => {
    it('should handle missing package.json', async () => {
      const result = await runCLI(['patch', '--no-git-check'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('No package.json files found')
    })

    it('should handle malformed package.json', async () => {
      writeFileSync(join(tempDir, 'package.json'), '{ invalid json }')

      const result = await runCLI(['patch', '--no-git-check'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Failed to read')
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
})
