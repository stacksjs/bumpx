import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const evidence = process.env.BUMPX_RECOVERY_EVIDENCE
const cli = resolve(import.meta.dir, '../bin/cli.ts')
const api = resolve(import.meta.dir, '../src/index.ts')
const children = new Set<Bun.Subprocess<'ignore', 'pipe', 'pipe'>>()
const commands: object[] = []
let workspace: string
let sequence = 0

function stop(child: Bun.Subprocess<'ignore', 'pipe', 'pipe'>) {
  try {
    if (process.platform === 'win32') child.kill('SIGKILL')
    else process.kill(-child.pid, 'SIGKILL')
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
}

async function run(label: string, argv: string[], cwd: string, timeoutMs: number) {
  const started = performance.now()
  const child = Bun.spawn(argv, {
    cwd, detached: process.platform !== 'win32', stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    env: {
      HOME: process.env.HOME!, PATH: process.env.PATH!,
      SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
      PATHEXT: process.env.PATHEXT, ComSpec: process.env.ComSpec,
      TMPDIR: workspace, TMP: workspace, TEMP: workspace,
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_CONFIG_SYSTEM: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
  })
  children.add(child)
  let timedOut = false
  let overflow = false
  const timer = setTimeout(() => { timedOut = true; stop(child) }, timeoutMs)
  async function capture(stream: ReadableStream<Uint8Array>) {
    const chunks: Uint8Array[] = []
    let count = 0
    for await (const chunk of stream) {
      const available = Math.max(0, 256 * 1024 - count)
      if (available) chunks.push(chunk.subarray(0, available))
      count += chunk.byteLength
      if (count > 256 * 1024) { overflow = true; stop(child) }
    }
    return Buffer.concat(chunks).toString()
  }
  try {
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, capture(child.stdout), capture(child.stderr)])
    const stem = `${String(sequence++).padStart(3, '0')}-${label}`
    if (evidence) {
      await writeFile(join(evidence, `${stem}.stdout.txt`), stdout)
      await writeFile(join(evidence, `${stem}.stderr.txt`), stderr)
    }
    const result = { exitCode, stdout, stderr, timedOut, overflow }
    commands.push({ label, argv, cwd, timeoutMs, pid: child.pid, elapsedMs: performance.now() - started, ...result })
    await record('commands.json', commands)
    return result
  }
  finally {
    clearTimeout(timer)
    stop(child)
    await child.exited
    children.delete(child)
  }
}

async function git(args: string[], cwd: string) {
  const result = await run('git', ['git', ...args], cwd, 2_000)
  expect(result, JSON.stringify(result)).toMatchObject({ exitCode: 0, timedOut: false, overflow: false })
  return result.stdout.trim()
}

async function record(name: string, value: unknown) {
  if (evidence) await writeFile(join(evidence, name), JSON.stringify(value, null, 2))
}

beforeAll(async () => {
  if (evidence) await mkdir(evidence, { recursive: true })
  workspace = await mkdtemp(join(tmpdir(), 'bumpx-release-recovery-'))
})

async function fixture(name: string) {
  const directory = join(workspace, name)
  const work = join(directory, 'work')
  const remote = join(directory, 'remote.git')
  await mkdir(work, { recursive: true })
  await git(['init', '--bare', '--initial-branch=main', '--template=', remote], directory)
  await git(['init', '--initial-branch=main', '--template='], work)
  await git(['config', 'user.name', 'Bumpx public fixture'], work)
  await git(['config', 'user.email', 'bumpx@example.invalid'], work)
  await git(['config', 'commit.gpgsign', 'false'], work)
  await git(['config', 'tag.gpgSign', 'false'], work)
  await writeFile(join(work, 'package.json'), '{"name":"release-fixture","private":true,"version":"0.1.0"}\n')
  await git(['add', 'package.json'], work)
  await git(['commit', '-m', 'test: initialize owned public release fixture'], work)
  await git(['remote', 'add', 'origin', remote], work)
  await git(['push', '-u', 'origin', 'main'], work)
  await writeFile(join(work, 'unrelated-untracked.txt'), 'retain this unrelated fixture exactly\n')
  return { directory, work, remote }
}

async function snapshot(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    HEAD: await git(['rev-parse', 'HEAD'], f.work),
    tags: await git(['for-each-ref', '--format=%(refname) %(objectname) %(*objectname)', 'refs/tags'], f.work),
    manifest: await readFile(join(f.work, 'package.json'), 'utf8'),
    HEADManifest: await git(['show', 'HEAD:package.json'], f.work),
    index: await git(['ls-files', '--stage'], f.work),
    status: await git(['status', '--porcelain=v1', '--untracked-files=all'], f.work),
    sentinel: await readFile(join(f.work, 'unrelated-untracked.txt'), 'utf8'),
    remoteRefs: await git(['--git-dir', f.remote, 'for-each-ref', '--format=%(refname) %(objectname) %(*objectname)'], f.directory),
  }
}

async function rejectPush(f: Awaited<ReturnType<typeof fixture>>) {
  await mkdir(join(f.remote, 'hooks'), { recursive: true })
  await writeFile(join(f.remote, 'hooks/pre-receive'), '#!/bin/sh\nprintf "%s\\n" BUMPX_PUBLIC30_PRE_RECEIVE_73 >&2\nprintf "%s\\n" 73 > pre-receive-73.marker\ncat >/dev/null\nexit 73\n', { mode: 0o755 })
  return join(f.remote, 'pre-receive-73.marker')
}

async function callbackFailure(f: Awaited<ReturnType<typeof fixture>>, event: string, message: string, options: Record<string, unknown>) {
  const driver = join(f.directory, 'callback.ts')
  await writeFile(driver, `import { versionBump } from ${JSON.stringify(api)}
const expected = new Error(${JSON.stringify(message)})
try {
  await versionBump({
    release: 'patch', cwd: ${JSON.stringify(f.work)}, files: [${JSON.stringify(join(f.work, 'package.json'))}],
    yes: true, changelog: false, ...${JSON.stringify(options)},
    progress(progress) { if (progress.event === ${JSON.stringify(event)}) throw expected },
  })
  throw new Error('Expected the public progress callback to reject')
}
catch (error) {
  if (error !== expected) throw error
  console.log(JSON.stringify({ sameOriginalError: true, message: expected.message }))
}
`)
  return run('public-api-callback', [process.execPath, driver], f.work, 5_000)
}

test('preserves a consistent release candidate and reports late transport failure', async () => {
  const f = await fixture('late-rejection')
  const marker = await rejectPush(f)
  const before = await snapshot(f)
  const result = await run('late-public-cli', [process.execPath, cli, 'patch', '--commit', '--tag', '--push', '--yes', '--no-changelog'], f.work, 5_000)
  const after = await snapshot(f)
  const observedMarker = await readFile(marker, 'utf8')
  await record('late-rejection.json', { fixture: f, before, result, after, observedMarker })
  expect(result).toMatchObject({ timedOut: false, overflow: false })
  expect(result.exitCode).not.toBe(0)
  expect(result.stdout + result.stderr).toContain('BUMPX_PUBLIC30_PRE_RECEIVE_73')
  expect(observedMarker).toBe('73\n')
  expect(after.HEAD).not.toBe(before.HEAD)
  expect(after.tags).toContain('refs/tags/v0.1.1')
  expect(after.tags.split('\n').find(line => line.startsWith('refs/tags/v0.1.1 '))?.split(' ')[2]).toBe(after.HEAD)
  expect(after.remoteRefs).toBe(before.remoteRefs)
  expect(after.sentinel).toBe(before.sentinel)
  expect(result.stdout + result.stderr).not.toContain('Rollback completed due to error.')
  expect(result.stderr).toContain('Release failed during Git push.')
  expect(result.stderr).toContain(after.HEAD)
  expect(result.stderr).toContain('Local release tag: v0.1.1')
  expect(result.stderr).toContain('Remote publication is unconfirmed.')
  expect(JSON.parse(after.manifest).version).toBe('0.1.1')
  expect(after.status).toBe('?? unrelated-untracked.txt')
})

test('ordinary success publishes matching release commit and tag without unrelated files', async () => {
  const f = await fixture('success')
  const before = await snapshot(f)
  const result = await run('successful-public-cli', [process.execPath, cli, 'patch', '--commit', '--tag', '--push', '--yes', '--no-changelog'], f.work, 5_000)
  const after = await snapshot(f)
  await record('success.json', { fixture: f, before, result, after })
  expect(result).toMatchObject({ exitCode: 0, timedOut: false, overflow: false })
  expect(after.remoteRefs).toContain(`refs/heads/main ${after.HEAD}`)
  expect(after.remoteRefs.split('\n').find(line => line.startsWith('refs/tags/v0.1.1 '))?.split(' ')[2]).toBe(after.HEAD)
  expect(after.tags).toContain('refs/tags/v0.1.1')
  expect(JSON.parse(after.manifest).version).toBe('0.1.1')
  expect(after.status).toBe('?? unrelated-untracked.txt')
  expect(after.sentinel).toBe(before.sentinel)
})

test('precommit required-command failure restores files without creating release refs', async () => {
  const f = await fixture('precommit-rejection')
  const before = await snapshot(f)
  const result = await run('precommit-public-cli', [process.execPath, cli, 'patch', '--commit', '--tag', '--push', '--yes', '--no-changelog', '--execute', 'bun -e "process.exit(23)"'], f.work, 5_000)
  const after = await snapshot(f)
  await record('precommit-rejection.json', { fixture: f, before, result, after })
  expect(result).toMatchObject({ timedOut: false, overflow: false })
  expect(result.exitCode).not.toBe(0)
  expect(after).toEqual(before)
})

test('a rejected tag-only release preserves no-commit and unrelated index ownership', async () => {
  const f = await fixture('tag-only')
  const marker = await rejectPush(f)
  await writeFile(join(f.work, 'notes.txt'), 'unrelated staged notes\n')
  await git(['add', 'notes.txt'], f.work)
  const before = await snapshot(f)
  const result = await run('tag-only-public-cli', [process.execPath, cli, 'patch', '--no-commit', '--tag', '--push', '--yes', '--no-changelog', '--no-git-check'], f.work, 5_000)
  const after = await snapshot(f)
  await record('tag-only.json', { fixture: f, before, result, after })
  expect(result).toMatchObject({ timedOut: false, overflow: false })
  expect(result.exitCode).not.toBe(0)
  expect(await readFile(marker, 'utf8')).toBe('73\n')
  expect(after.HEAD).toBe(before.HEAD)
  expect(after.index).toBe(before.index)
  expect(after.tags.split(' ')[2]).toBe(before.HEAD)
  expect(JSON.parse(after.manifest).version).toBe('0.1.1')
  expect(after.remoteRefs).toBe(before.remoteRefs)
  expect(after.sentinel).toBe(before.sentinel)
  expect(result.stderr).toContain('Local release tag: v0.1.1')
  expect(result.stderr).not.toContain('Local release commit:')
  expect(result.stdout + result.stderr).not.toContain('Rollback completed')
})

for (const boundary of [
  { name: 'commit cancellation', event: 'gitCommit', message: 'Version bump cancelled by user', commit: true, tag: true, hasTag: false },
  { name: 'tag callback error', event: 'gitTag', message: 'original tag callback failure', commit: false, tag: true, hasTag: true },
  { name: 'tag cancellation', event: 'gitTag', message: 'Version bump cancelled by user', commit: true, tag: true, hasTag: true },
]) {
  test(`preserves candidate state and the original error after ${boundary.name}`, async () => {
    const f = await fixture(boundary.event + '-' + boundary.name.replaceAll(' ', '-'))
    const before = await snapshot(f)
    const result = await callbackFailure(f, boundary.event, boundary.message, { commit: boundary.commit, tag: boundary.tag, push: false })
    const after = await snapshot(f)
    await record(boundary.name + '.json', { fixture: f, before, result, after })
    expect(result).toMatchObject({ exitCode: 0, timedOut: false, overflow: false })
    expect(JSON.parse(result.stdout.trim().split('\n').at(-1)!)).toEqual({ sameOriginalError: true, message: boundary.message })
    expect(JSON.parse(after.manifest).version).toBe('0.1.1')
    expect(after.HEAD === before.HEAD).toBe(!boundary.commit)
    if (boundary.commit) expect(after.status).toBe('?? unrelated-untracked.txt')
    else expect(after.index).toBe(before.index)
    expect(after.tags.includes('refs/tags/v0.1.1')).toBe(boundary.hasTag)
    expect(after.remoteRefs).toBe(before.remoteRefs)
    expect(after.sentinel).toBe(before.sentinel)
    expect(result.stdout + result.stderr).not.toContain('Rollback completed')
    expect(result.stderr).toContain('Candidate files, index and local refs were retained.')
    expect(result.stderr).toContain(boundary.message)
    expect(result.stderr).not.toContain('already exists')
  })
}

test('caught precommit cancellation restores files without disturbing a no-commit index', async () => {
  const f = await fixture('precommit-cancellation')
  await writeFile(join(f.work, 'notes.txt'), 'unrelated staged notes\n')
  await git(['add', 'notes.txt'], f.work)
  const before = await snapshot(f)
  const result = await callbackFailure(f, 'execute', 'Version bump cancelled by user', { commit: false, tag: false, push: false, noGitCheck: true, execute: 'this-command-must-not-run' })
  const after = await snapshot(f)
  await record('precommit-cancellation.json', { fixture: f, before, result, after })
  expect(result).toMatchObject({ exitCode: 0, timedOut: false, overflow: false })
  expect(JSON.parse(result.stdout.trim().split('\n').at(-1)!)).toEqual({ sameOriginalError: true, message: 'Version bump cancelled by user' })
  expect(after).toEqual(before)
  expect(result.stdout).toContain('Rollback completed. No changes were made.')
})

test('an error after a successful push does not claim remote rollback or uncertainty', async () => {
  const f = await fixture('push-callback-error')
  const before = await snapshot(f)
  const result = await callbackFailure(f, 'gitPush', 'original push callback failure', { commit: true, tag: true, push: true })
  const after = await snapshot(f)
  await record('push-callback-error.json', { fixture: f, before, result, after })
  expect(result).toMatchObject({ exitCode: 0, timedOut: false, overflow: false })
  expect(JSON.parse(result.stdout.trim().split('\n').at(-1)!)).toEqual({ sameOriginalError: true, message: 'original push callback failure' })
  expect(after.remoteRefs).toContain(`refs/heads/main ${after.HEAD}`)
  expect(after.remoteRefs.split('\n').find(line => line.startsWith('refs/tags/v0.1.1 '))?.split(' ')[2]).toBe(after.HEAD)
  expect(JSON.parse(after.manifest).version).toBe('0.1.1')
  expect(after.status).toBe('?? unrelated-untracked.txt')
  expect(result.stderr).toContain('Git push completed before this error. No remote rollback was attempted.')
  expect(result.stderr).not.toContain('Remote publication is unconfirmed.')
  expect(result.stdout + result.stderr).not.toContain('Rollback completed')
})

test('a tag creation failure preserves the partial release commit and original Git error', async () => {
  const f = await fixture('invalid-tag')
  const before = await snapshot(f)
  const result = await run('invalid-tag-public-cli', [process.execPath, cli, 'patch', '--commit', '--tag', '--tag-name', 'invalid tag', '--yes', '--no-changelog'], f.work, 5_000)
  const after = await snapshot(f)
  await record('invalid-tag.json', { fixture: f, before, result, after })
  expect(result).toMatchObject({ timedOut: false, overflow: false })
  expect(result.exitCode).not.toBe(0)
  expect(after.HEAD).not.toBe(before.HEAD)
  expect(after.tags).toBe('')
  expect(after.status).toBe('?? unrelated-untracked.txt')
  expect(JSON.parse(after.manifest).version).toBe('0.1.1')
  expect(after.remoteRefs).toBe(before.remoteRefs)
  expect(result.stderr).toContain('invalid tag')
  expect(result.stderr).toContain('Release failed during local release tag.')
  expect(result.stderr).not.toContain('already exists')
  expect(result.stdout + result.stderr).not.toContain('Rollback completed')
})

test('an existing foreign tag is not reported as a tag created by the failed release', async () => {
  const f = await fixture('foreign-tag')
  // Introduce a foreign tag at the actual Git commit boundary, after the
  // public CLI's initial collision check but before final tag creation.
  await mkdir(join(f.work, '.git/hooks'), { recursive: true })
  await writeFile(join(f.work, '.git/hooks/post-commit'), '#!/bin/sh\ngit tag -a v0.1.1 -m "foreign post-commit tag" || exit\ngit for-each-ref --format="%(refname) %(objectname) %(*objectname)" refs/tags > .git/foreign-tag.marker\n', { mode: 0o755 })
  const before = await snapshot(f)
  const result = await run('foreign-tag-public-cli', [process.execPath, cli, 'patch', '--commit', '--tag', '--yes', '--no-changelog'], f.work, 5_000)
  const after = await snapshot(f)
  const foreignTag = (await readFile(join(f.work, '.git/foreign-tag.marker'), 'utf8')).trim()
  await record('foreign-tag.json', { fixture: f, before, result, after, foreignTag })
  expect(result).toMatchObject({ timedOut: false, overflow: false })
  expect(result.exitCode).not.toBe(0)
  expect(foreignTag).toContain('refs/tags/v0.1.1 ')
  expect(after.tags).toBe(foreignTag)
  expect(after.HEAD).not.toBe(before.HEAD)
  expect(after.status).toBe('?? unrelated-untracked.txt')
  expect(JSON.parse(after.manifest).version).toBe('0.1.1')
  expect(result.stderr).toContain('already exists')
  expect(result.stderr).toContain('Local release commit:')
  expect(result.stderr).not.toContain('Local release tag:')
})

test('incomplete precommit file restoration never reports completed rollback', async () => {
  const f = await fixture('blocked-restoration')
  const before = await snapshot(f)
  const command = 'bun -e "import { rmSync, mkdirSync, writeFileSync } from \'node:fs\'; rmSync(\'package.json\'); mkdirSync(\'package.json\'); writeFileSync(\'package.json/foreign\', \'retain\'); console.log(\'BUMPX_RESTORE_BLOCKED\'); process.exit(23)"'
  const result = await run('blocked-restoration-public-cli', [process.execPath, cli, 'patch', '--commit', '--tag', '--yes', '--no-changelog', '--execute', command], f.work, 5_000)
  const after = { HEAD: await git(['rev-parse', 'HEAD'], f.work), tags: await git(['tag', '--list'], f.work), index: await git(['ls-files', '--stage'], f.work), foreign: await readFile(join(f.work, 'package.json/foreign'), 'utf8') }
  await record('blocked-restoration.json', { fixture: f, before, result, after })
  expect(result).toMatchObject({ timedOut: false, overflow: false })
  expect(result.exitCode).not.toBe(0)
  expect((await stat(join(f.work, 'package.json'))).isDirectory()).toBe(true)
  expect(after).toEqual({ HEAD: before.HEAD, tags: '', index: before.index, foreign: 'retain' })
  expect(result.stdout + result.stderr).toContain('BUMPX_RESTORE_BLOCKED')
  expect(result.stdout + result.stderr).toContain('process.exit(23)')
  expect(result.stdout + result.stderr).toContain('Rollback incomplete.')
  expect(result.stdout + result.stderr).not.toContain('Rollback completed')
})

afterAll(async () => {
  for (const child of children) stop(child)
  await Promise.all([...children].map(child => child.exited))
  expect(children.size).toBe(0)
  await record('cleanup.json', { activeChildren: children.size, workspace, HOMEUnchanged: true })
  if (workspace && !evidence) await rm(workspace, { recursive: true, force: true })
})
