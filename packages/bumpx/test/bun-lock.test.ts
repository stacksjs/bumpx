import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { updateBunWorkspaceLock } from '../src/bun-lock'

describe('Bun workspace lock updates', () => {
  let directory: string
  let lockPath: string

  beforeEach(() => {
    directory = join(tmpdir(), `bumpx-bun-lock-${crypto.randomUUID()}`)
    mkdirSync(directory, { recursive: true })
    lockPath = join(directory, 'bun.lock')
  })

  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  it('updates selected workspace versions while preserving the text lock', () => {
    const content = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": { "name": "root" },
    "packages/a": {
      "name": "@scope/a",
      "version": "1.0.0",
      "dependencies": { "external": "^2.0.0" },
    },
    "packages/b": { "name": "@scope/b", "version": "1.0.0" },
  },
  "packages": { "external": ["external@2.0.0", "", {}, "hash,}"] },
}\n`
    writeFileSync(lockPath, content)

    expect(updateBunWorkspaceLock(lockPath, new Map([
      ['', '1.1.0'],
      ['packages/a', '1.1.0'],
    ])).updated).toBe(true)

    const updated = readFileSync(lockPath, 'utf8')
    expect(updated).toBe(content.replace('"version": "1.0.0"', '"version": "1.1.0"'))
  })

  it('does not write during a dry run', () => {
    const content = '{ "workspaces": { "packages/a": { "version": "1.0.0", }, }, }\n'
    writeFileSync(lockPath, content)
    expect(updateBunWorkspaceLock(lockPath, new Map([['packages/a', '1.1.0']]), true).updated).toBe(true)
    expect(readFileSync(lockPath, 'utf8')).toBe(content)
  })

  it('leaves unrelated locks byte-for-byte unchanged', () => {
    const content = '{ "workspaces": { "packages/b": { "version": "1.0.0", }, }, }\n'
    writeFileSync(lockPath, content)
    expect(updateBunWorkspaceLock(lockPath, new Map([['packages/a', '1.1.0']])).updated).toBe(false)
    expect(readFileSync(lockPath, 'utf8')).toBe(content)
  })

  it('fails closed on malformed lock data', () => {
    writeFileSync(lockPath, '{ "workspaces": {')
    expect(() => updateBunWorkspaceLock(lockPath, new Map())).toThrow('Malformed bun.lock')
  })
})
