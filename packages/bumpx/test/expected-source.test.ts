import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const cli = resolve(import.meta.dir, '../bin/cli.ts')
let root: string
let publisher: string
let writer: string
let qualified: string
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
}
function bump(extra: string[] = [], expected = qualified): { code: number, output: string } {
  const child = Bun.spawnSync([process.execPath, cli, 'patch', '--push', '--yes', '--no-recursive', '--no-changelog', ...extra], {
    cwd: publisher, env: { ...process.env, BUMPX_EXPECTED_SOURCE: expected }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000,
  })
  return { code: child.exitCode, output: child.stdout.toString() + child.stderr.toString() }
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bumpx-expected-source-'))
  const origin = join(root, 'origin.git')
  writer = join(root, 'writer')
  publisher = join(root, 'publisher')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  execFileSync('git', ['clone', '-q', origin, writer])
  git(writer, 'config', 'user.name', 'Chris Breuer')
  git(writer, 'config', 'user.email', 'chrisbreuer93@gmail.com')
  writeFileSync(join(writer, 'package.json'), JSON.stringify({ name: 'source-fixture', version: '1.0.0' }) + '\n')
  writeFileSync(join(writer, 'README.md'), 'qualified\n')
  git(writer, 'add', '.')
  git(writer, 'commit', '-qm', 'qualified source')
  git(writer, 'push', '-q', '-u', 'origin', 'main')
  qualified = git(writer, 'rev-parse', 'HEAD')
  execFileSync('git', ['clone', '-q', origin, publisher])
  git(publisher, 'config', 'user.name', 'Chris Breuer')
  git(publisher, 'config', 'user.email', 'chrisbreuer93@gmail.com')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('qualified source precondition', () => {
  it('refuses a real Main advance adopted by the normal pull before release mutations', () => {
    writeFileSync(join(writer, 'README.md'), 'new unqualified source\n')
    git(writer, 'commit', '-qam', 'unqualified advance')
    git(writer, 'push', '-q')
    const advanced = git(writer, 'rev-parse', 'HEAD')
    const result = bump()
    expect(result.code).not.toBe(0)
    expect(result.output).toContain(`Expected source ${qualified}`)
    expect(git(publisher, 'rev-parse', 'HEAD')).toBe(advanced)
    expect(JSON.parse(readFileSync(join(publisher, 'package.json'), 'utf8')).version).toBe('1.0.0')
    expect(git(publisher, 'status', '--porcelain')).toBe('')
    expect(git(publisher, 'tag', '--list')).toBe('')
    expect(git(publisher, 'ls-remote', '--tags', 'origin')).toBe('')
    expect(git(publisher, 'ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0]).toBe(advanced)
    expect(git(publisher, 'rev-list', '--count', 'HEAD')).toBe('2')
  })
  it('does not let no-git-check waive an explicit expected source', () => {
    const result = bump(['--no-git-check'], '0'.repeat(40))
    expect(result.code).not.toBe(0)
    expect(JSON.parse(readFileSync(join(publisher, 'package.json'), 'utf8')).version).toBe('1.0.0')
    expect(git(publisher, 'tag', '--list')).toBe('')
  })
  it('preserves the ordinary atomic commit and tag push when the source matches', () => {
    const result = bump()
    expect(result.code).toBe(0)
    expect(JSON.parse(readFileSync(join(publisher, 'package.json'), 'utf8')).version).toBe('1.0.1')
    const head = git(publisher, 'rev-parse', 'HEAD')
    expect(git(publisher, 'rev-parse', 'HEAD^')).toBe(qualified)
    expect(git(publisher, 'rev-parse', 'v1.0.1^{commit}')).toBe(head)
    expect(git(publisher, 'ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0]).toBe(head)
  })
  it('accepts the documented CLI option and rejects incomplete hashes', () => {
    const result = bump(['--expected-source', qualified], '0'.repeat(40))
    expect(result.code).toBe(0)
    expect(bump([], 'short').code).not.toBe(0)
  })
})
