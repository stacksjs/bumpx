import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * A release must not be cut from a dirty working tree.
 *
 * `--yes` used to set `noGitCheck` as well — "for smoother workflow". Every
 * release script in this org is `bumpx <bump> --recursive --yes`, so the
 * clean-tree check effectively did not exist: a release could be tagged from a
 * tree with modified tracked files, producing a tag whose contents are not what
 * anyone built or tested, with unrelated work-in-progress sitting underneath it.
 *
 * Answering prompts and waiving safety checks are different things. These tests
 * pin them apart.
 */

const CLI = path.resolve(import.meta.dir, '../bin/cli.ts')

let repo: string

function git(...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
}

function bumpx(...args: string[]): { code: number, out: string } {
  const run = Bun.spawnSync(['bun', CLI, ...args], { cwd: repo })
  return {
    code: run.exitCode ?? 0,
    out: `${run.stdout?.toString() ?? ''}${run.stderr?.toString() ?? ''}`,
  }
}

function version(): string {
  return JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bumpx-clean-'))
  execFileSync('git', ['init', '-q', '-b', 'main', repo])
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'lab', version: '1.0.0' }, null, 2)}\n`)
  fs.writeFileSync(path.join(repo, 'README.md'), '# lab\n')
  git('add', '-A')
  git('commit', '-qm', 'init')
})

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true })
})

describe('clean-tree guard', () => {
  it('refuses to release when a tracked file is modified, even with --yes', () => {
    fs.appendFileSync(path.join(repo, 'README.md'), 'uncommitted work\n')

    const { code, out } = bumpx('patch', '--yes', '--no-push')

    expect(code).not.toBe(0)
    expect(out).toContain('not clean')
    expect(version()).toBe('1.0.0')
  })

  it('names the offending file and what to do about it', () => {
    fs.appendFileSync(path.join(repo, 'README.md'), 'uncommitted work\n')

    const { out } = bumpx('patch', '--yes', '--no-push')

    expect(out).toContain('README.md')
    expect(out).toContain('--no-git-check')
  })

  it('refuses when a change is merely staged', () => {
    fs.appendFileSync(path.join(repo, 'README.md'), 'staged work\n')
    git('add', 'README.md')

    const { code } = bumpx('patch', '--yes', '--no-push')

    expect(code).not.toBe(0)
    expect(version()).toBe('1.0.0')
  })

  it('still releases from a clean tree with --yes', () => {
    // The guard must not make the ordinary path unusable.
    const { code } = bumpx('patch', '--yes', '--no-push')

    expect(code).toBe(0)
    expect(version()).toBe('1.0.1')
  })

  it('ignores untracked files, which release files are staged by path around', () => {
    // Deliberate: a scratch file in the worktree is not a reason to block a
    // release, because nothing sweeps it in — `git add -- <release files>`.
    fs.writeFileSync(path.join(repo, 'notes.txt'), 'scratch\n')

    const { code } = bumpx('patch', '--yes', '--no-push')

    expect(code).toBe(0)
    expect(version()).toBe('1.0.1')
    expect(git('status', '--porcelain')).toContain('notes.txt')
  })

  it('--no-git-check remains the explicit opt-out', () => {
    fs.appendFileSync(path.join(repo, 'README.md'), 'uncommitted work\n')

    const { code } = bumpx('patch', '--yes', '--no-git-check', '--no-push')

    expect(code).toBe(0)
    expect(version()).toBe('1.0.1')
  })

  it('commits only the release files, leaving dirty work behind', () => {
    // The other half of the guarantee: even when the check is waived, a
    // release commit contains package.json and the changelog — never whatever
    // else happened to be in the tree.
    fs.appendFileSync(path.join(repo, 'README.md'), 'uncommitted work\n')

    bumpx('patch', '--yes', '--no-git-check', '--no-push')

    const touched = git('show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean)
    expect(touched).not.toContain('README.md')
    expect(git('status', '--porcelain')).toContain('README.md')
  })
})
