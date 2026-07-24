import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { updatePantryWorkspaceLock } from '../src/pantry-lock'

describe('Pantry workspace lock updates', () => {
  let directory: string
  let lockPath: string

  beforeEach(() => {
    directory = join(tmpdir(), `bumpx-pantry-lock-${crypto.randomUUID()}`)
    mkdirSync(directory, { recursive: true })
    lockPath = join(directory, 'pantry.lock')
  })

  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  it('updates selected workspace versions without changing package metadata', () => {
    writeFileSync(lockPath, JSON.stringify({
      lockfileVersion: 1,
      workspaces: {
        '': { name: 'root' },
        'packages/a': { name: '@scope/a', version: '1.0.0' },
        'packages/b': { name: '@scope/b', version: '1.0.0' },
      },
      packages: { 'external@2.0.0': { version: '2.0.0', integrity: 'sha512-unchanged' } },
    }, null, 2))

    const result = updatePantryWorkspaceLock(lockPath, new Map([
      ['', '1.1.0'],
      ['packages/a', '1.1.0'],
    ]))
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'))

    expect(result.updated).toBe(true)
    expect(lock.workspaces[''].version).toBeUndefined()
    expect(lock.workspaces['packages/a'].version).toBe('1.1.0')
    expect(lock.workspaces['packages/b'].version).toBe('1.0.0')
    expect(lock.packages['external@2.0.0']).toEqual({ version: '2.0.0', integrity: 'sha512-unchanged' })
  })

  it('does not write during a dry run', () => {
    const content = `${JSON.stringify({ workspaces: { 'packages/a': { version: '1.0.0' } } }, null, 2)}\n`
    writeFileSync(lockPath, content)
    expect(updatePantryWorkspaceLock(lockPath, new Map([['packages/a', '1.1.0']]), true).updated).toBe(true)
    expect(readFileSync(lockPath, 'utf8')).toBe(content)
  })

  it('leaves unrelated locks byte-for-byte unchanged', () => {
    const content = `${JSON.stringify({ workspaces: { 'packages/b': { version: '1.0.0' } } }, null, 2)}\n`
    writeFileSync(lockPath, content)
    expect(updatePantryWorkspaceLock(lockPath, new Map([['packages/a', '1.1.0']])).updated).toBe(false)
    expect(readFileSync(lockPath, 'utf8')).toBe(content)
  })

  it('accepts current Pantry v1 package locks without rewriting them', () => {
    const content = `${JSON.stringify({
      version: '1.0',
      lockfileVersion: 1,
      packages: {
        '@stacksjs/bumpx@0.2.11': {
          name: '@stacksjs/bumpx',
          version: '0.2.11',
          source: 'pantry',
        },
      },
    }, null, 2)}\n`
    writeFileSync(lockPath, content)

    expect(updatePantryWorkspaceLock(lockPath, new Map([['', '0.3.0']]))).toEqual({
      updated: false,
      originalContent: content,
    })
    expect(readFileSync(lockPath, 'utf8')).toBe(content)
  })

  it('fails closed on malformed lock data', () => {
    writeFileSync(lockPath, '{ invalid')
    expect(() => updatePantryWorkspaceLock(lockPath, new Map())).toThrow('Malformed pantry.lock')
  })
})
