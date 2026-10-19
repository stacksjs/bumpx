import { afterEach, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { VersionBumpOptions, VersionBumpProgress } from '../src/types'
import { ProgressEvent } from '../src/types'
import { versionBump } from '../src/version-bump'

const fixtures: string[] = []
afterEach(() => fixtures.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

function fixture(readonly = false): { cwd: string, paths: string[] } {
  const cwd = mkdtempSync(join(tmpdir(), 'bumpx-dry-run-immutable-'))
  fixtures.push(cwd)
  mkdirSync(join(cwd, 'packages/leaf'), { recursive: true })
  const paths = ['package.json', 'packages/leaf/package.json', 'version.txt'].map(file => join(cwd, file))
  writeFileSync(paths[0], JSON.stringify({ name: 'root', version: '1.2.3', workspaces: ['packages/*'] }, null, 2))
  writeFileSync(paths[1], JSON.stringify({ name: 'leaf', version: '3.4.5' }, null, 2))
  writeFileSync(paths[2], 'version = 1.2.3\n')
  for (const path of paths) {
    // Even a same-byte write must be observable on a fast filesystem.
    utimesSync(path, new Date('2020-01-01'), new Date('2020-01-01'))
    if (readonly) chmodSync(path, 0o444)
  }
  return { cwd, paths }
}

function snapshot(paths: string[]): unknown[] {
  return paths.map(path => {
    const { dev, ino, mode, size, mtimeNs, ctimeNs } = statSync(path, { bigint: true })
    return { path, content: readFileSync(path, 'utf8'), dev, ino, mode, size, mtimeNs, ctimeNs }
  })
}

const modes = ['explicit current version', 'recursive workspace', 'independent versions'] as const
function options(mode: typeof modes[number], cwd: string): VersionBumpOptions {
  return {
    cwd,
    release: 'patch',
    dryRun: true,
    noGitCheck: true,
    commit: false,
    tag: false,
    push: false,
    changelog: false,
    ...(mode === 'recursive workspace'
      ? { recursive: true }
      : { files: ['package.json', 'packages/leaf/package.json'] }),
    ...(mode === 'explicit current version' ? { currentVersion: '1.2.3' } : {}),
    additionalFiles: ['version.txt'],
  }
}

for (const mode of modes) {
  for (const readonly of [false, true]) {
    test(`${mode}: previews ${readonly ? 'read-only' : 'writable'} files without changing bytes or identities`, async () => {
      const { cwd, paths } = fixture(readonly)
      const before = snapshot(paths)
      const progress: VersionBumpProgress[] = []
      await versionBump({ ...options(mode, cwd), progress: event => progress.push(event) })
      expect(progress.some(event => event.event === ProgressEvent.FileUpdated && event.updatedFiles.includes(paths[0]) && event.newVersion === '1.2.4')).toBe(true)
      expect(snapshot(paths)).toEqual(before)
    })
  }

  test(`${mode}: an interrupted preview never rolls back files it did not write`, async () => {
    const { cwd, paths } = fixture()
    const before = snapshot(paths)
    await expect(versionBump({
      ...options(mode, cwd),
      progress: () => { throw new Error('EACCES: simulated observer failure') },
    })).rejects.toThrow('simulated observer failure')
    expect(snapshot(paths)).toEqual(before)
  })
}
