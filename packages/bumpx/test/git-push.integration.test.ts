import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const decoder = new TextDecoder()

function run(cmd: string, args: string[], cwd: string): { status: number, stdout: string, stderr: string } {
  const res = Bun.spawnSync([cmd, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  return {
    status: res.exitCode,
    stdout: decoder.decode(res.stdout),
    stderr: decoder.decode(res.stderr),
  }
}

function runGit(args: string[], cwd: string) {
  const res = run('git', args, cwd)
  if (res.status !== 0)
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`)
  return res.stdout
}

describe('Git push & tag integration (local bare remote)', () => {
  let tempDir: string
  let workDir: string
  let bareDir: string
  let bumpxBin: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = join(tmpdir(), `bumpx-push-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    workDir = join(tempDir, 'work')
    bareDir = join(tempDir, 'remote.git')
    mkdirSync(workDir, { recursive: true })

    // Path resolution similar to cli-integration.test.ts
    const builtBin = join(__dirname, '..', 'dist', 'bin', 'cli.js')
    const sourceBin = join(__dirname, '..', 'bin', 'cli.ts')
    const compiledBin = join(__dirname, '..', 'bin', 'bumpx')

    if (process.env.CI && existsSync(builtBin))
      bumpxBin = builtBin
    else if (existsSync(compiledBin))
      bumpxBin = compiledBin
    else if (existsSync(builtBin))
      bumpxBin = builtBin
    else bumpxBin = sourceBin

    // Setup bare remote
    mkdirSync(bareDir, { recursive: true })
    runGit(['init', '--bare', bareDir], tempDir)

    // Setup working repo
    runGit(['init'], workDir)
    // Configure identity
    runGit(['config', 'user.email', 'test@example.com'], workDir)
    runGit(['config', 'user.name', 'bumpx tester'], workDir)

    // Create initial package.json
    writeFileSync(join(workDir, 'package.json'), JSON.stringify({ name: 'pkg', version: '0.1.0' }, null, 2))
    runGit(['add', '.'], workDir)
    runGit(['commit', '-m', 'chore: init'], workDir)
    // Ensure on main branch and set remote
    try {
      runGit(['checkout', '-b', 'main'], workDir)
    }
    catch {
      // If main exists already, just checkout
      runGit(['checkout', 'main'], workDir)
    }
    runGit(['remote', 'add', 'origin', bareDir], workDir)
    // Set upstream so pull/push paths are valid
    runGit(['push', '-u', 'origin', 'main'], workDir)
  })

  afterEach(() => {
    try {
      process.chdir(originalCwd)
    }
    catch {}
    if (existsSync(tempDir))
      rmSync(tempDir, { recursive: true, force: true })
  })

  const runCLI = (args: string[], cwd: string): Promise<{ code: number, stdout: string, stderr: string }> => {
    return new Promise((resolve) => {
      const isCompiledBinary = bumpxBin.endsWith('bumpx') && !bumpxBin.endsWith('.ts') && !bumpxBin.endsWith('.js')
      const isBuiltJS = bumpxBin.endsWith('.js')
      const isSourceTS = bumpxBin.endsWith('.ts')

      let command: string
      let cmdArgs: string[]
      if (isCompiledBinary) {
        command = bumpxBin
        cmdArgs = args
      }
      else if (isBuiltJS || isSourceTS) {
        command = 'bun'
        cmdArgs = [bumpxBin, ...args]
      }
      else {
        command = 'bun'
        cmdArgs = [bumpxBin, ...args]
      }

      // Sandbox git for the CLI process to the temporary repo only
      const gitEnv = {
        ...process.env,
        GIT_DIR: join(cwd, '.git'),
        GIT_WORK_TREE: cwd,
        // Isolate HOME so global git config/hooks aren't used
        HOME: tempDir,
        // Common: disable husky or other git hooks
        HUSKY: '0',
      } as Record<string, string>

      const res = Bun.spawnSync([command, ...cmdArgs], { cwd, stdout: 'pipe', stderr: 'pipe', env: gitEnv })
      resolve({ code: res.exitCode, stdout: decoder.decode(res.stdout), stderr: decoder.decode(res.stderr) })
    })
  }

  it('pushes commit and tag to local bare remote (single package)', async () => {
    // Run bumpx to minor bump, with commit, tag, and push
    const res = await runCLI(['minor', '--commit', '--tag', '--push', '--yes'], workDir)

    expect(res.code).toBe(0)
    // Verify tag exists in bare repo
    const tags = run('git', ['--git-dir', bareDir, 'show-ref', '--tags'], tempDir)
    expect(tags.status).toBe(0)
    expect(tags.stdout).toMatch(/refs\/tags\/v0\.2\.0/) // 0.1.0 -> 0.2.0

    // Verify branch updated in bare
    const heads = run('git', ['--git-dir', bareDir, 'show-ref', '--heads'], tempDir)
    expect(heads.status).toBe(0)
    expect(heads.stdout).toMatch(/refs\/heads\/main/)
  })

  it('pushes commit and tag in recursive monorepo mode with -r', async () => {
    // Create monorepo structure
    const pkgsDir = join(workDir, 'packages')
    mkdirSync(pkgsDir, { recursive: true })
    // Ensure directories exist first
    mkdirSync(join(pkgsDir, 'a'), { recursive: true })
    mkdirSync(join(pkgsDir, 'b'), { recursive: true })
    writeFileSync(join(pkgsDir, 'a', 'package.json'), JSON.stringify({ name: '@test/a', version: '0.1.0' }, null, 2))
    writeFileSync(join(pkgsDir, 'b', 'package.json'), JSON.stringify({ name: '@test/b', version: '0.1.0' }, null, 2))
    writeFileSync(join(workDir, 'package.json'), JSON.stringify({ name: 'root', private: true, version: '0.1.0', workspaces: ['packages/*'] }, null, 2))

    runGit(['add', '.'], workDir)
    runGit(['commit', '-m', 'chore: add workspaces'], workDir)

    const res = await runCLI(['patch', '-r', '--commit', '--tag', '--push', '--yes'], workDir)
    expect(res.code).toBe(0)

    // Tag should exist
    const tags = run('git', ['--git-dir', bareDir, 'show-ref', '--tags'], tempDir)
    expect(tags.status).toBe(0)
    expect(tags.stdout).toMatch(/refs\/tags\/v0\.1\.1/) // patch bump
  })
})
