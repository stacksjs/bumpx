import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

/**
 * The published bin starts with `#!/usr/bin/env node`, so an npm install runs
 * bumpx on Node, not Bun. That distinction used to matter a great deal:
 * `import * as process from 'node:process'` gives an ESM namespace built from
 * the module's own properties, and process's EventEmitter methods live on its
 * prototype — so `process.on` was `undefined` under Node and any release died
 * on `TypeError: <minified>.on is not a function` partway through.
 *
 * These tests run the built bundle the way the shebang does.
 */
describe('running the built CLI under Node', () => {
  let tempDir: string

  const dist = resolve(import.meta.dir, '../dist/bin/cli.js')

  // The dist is what npm installs and what the shebang points Node at.
  // Without a build, or without Node on PATH, there is nothing to check here —
  // and skipping beats a false red.
  const hasDist = existsSync(dist)
  const hasNode = (() => {
    try {
      execFileSync('node', ['--version'], { stdio: 'ignore' })
      return true
    }
    catch {
      return false
    }
  })()
  const runnable = hasDist && hasNode

  const node = (args: string[], cwd: string) => {
    try {
      const stdout = execFileSync('node', [dist, ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
        env: {
          HOME: process.env.HOME!,
          PATH: process.env.PATH!,
          TMPDIR: cwd,
          GIT_TERMINAL_PROMPT: '0',
        },
      })
      return { code: 0, output: stdout }
    }
    catch (error: any) {
      return {
        code: typeof error.status === 'number' ? error.status : 1,
        output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
      }
    }
  }

  const git = (args: string[], cwd: string) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'bumpx-node-runtime-'))
    writeFileSync(
      join(tempDir, 'package.json'),
      `${JSON.stringify({ name: 'fixture', version: '1.0.0' }, null, 2)}\n`,
    )
    git(['init', '-q', '.'], tempDir)
    git(['add', '-A'], tempDir)
    git(['-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-qm', 'init'], tempDir)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it.skipIf(!runnable)('completes the release from the issue without a TypeError', () => {
    const result = node(
      ['--no-commit', '--no-tag', '--no-push', '--ci', '20260202.1.2'],
      tempDir,
    )

    expect(result.output).not.toContain('is not a function')
    expect(result.code).toBe(0)
    expect(JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf8')).version)
      .toBe('20260202.1.2')
  })

  it.skipIf(!runnable)('keeps quiet runs quiet, commit listing included', () => {
    const result = node(
      ['--no-commit', '--no-tag', '--no-push', '--ci', '20260202.1.2'],
      tempDir,
    )

    // --ci implies --quiet, and printCommits defaults to true, so this used to
    // print a commit listing and nothing else.
    expect(result.output).not.toContain('Recent commits:')
  })

  it.skipIf(!runnable)('still prints the listing when it was asked for', () => {
    const result = node(
      ['patch', '--print-commits', '--no-commit', '--no-tag', '--no-push'],
      tempDir,
    )

    expect(result.code).toBe(0)
    expect(result.output).toContain('Recent commits:')
  })

  /**
   * The combination that matters, and the one a first attempt at this got
   * wrong: suppressing the listing whenever the run is quiet also suppressed
   * it for somebody who asked for it by name. `--ci` implies quiet, and every
   * CI provider sets `CI`, so that turned an explicit flag into a no-op on the
   * exact machines people pass it on.
   */
  it.skipIf(!runnable)('prints the listing when asked, even in a quiet run', () => {
    const result = node(
      ['patch', '--ci', '--print-commits', '--no-commit', '--no-tag', '--no-push'],
      tempDir,
    )

    expect(result.code).toBe(0)
    expect(result.output).toContain('Recent commits:')
  })
})
