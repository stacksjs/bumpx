import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cli = join(import.meta.dir, '../bin/cli.ts')

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'bumpx-additional-manifests-'))
  const manifest = (path: string, value: Record<string, unknown>) => {
    mkdirSync(join(root, path), { recursive: true })
    writeFileSync(join(root, path, 'package.json'), `${JSON.stringify({ version: '1.0.0', ...value })}\n`)
  }
  manifest('.', { name: 'release-root', private: true, workspaces: ['packages/*', '!packages/vscode', '!packages/unchanged'] })
  manifest('packages/runtime', { name: 'runtime' })
  manifest('packages/vscode', { name: 'editor', dependencies: { runtime: 'workspace:*' } })
  manifest('packages/unchanged', { name: 'unrelated-editor' })
  manifest('node_modules/vendor', { name: 'vendor' })
  writeFileSync(join(root, 'bumpx.config.ts'), `export default {
    additionalFiles: ['packages/vscode/package.json', './packages/vscode/package.json', 'packages/runtime/package.json', 'packages/unchanged/package.json'],
  }\n`)
  return root
}

function run(root: string, args: string[]): void {
  const child = Bun.spawnSync(args, { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  expect(`${child.stdout.toString()}${child.stderr.toString()}`).not.toContain('Error:')
  expect(child.exitCode).toBe(0)
}

function bump(root: string, args: string[] = []): void {
  run(root, [process.execPath, cli, 'patch', '--recursive', '--yes', '--no-commit', '--no-tag', '--no-push', '--no-changelog', '--quiet', ...args])
}

function version(root: string, path: string): string {
  return JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')).version
}

test('configured release manifests join workspace discovery and overlapping paths bump once', () => {
  const root = fixture()
  try {
    bump(root)
    for (const path of ['.', 'packages/runtime', 'packages/vscode', 'packages/unchanged'])
      expect(version(root, path)).toBe('1.0.1')
    expect(version(root, 'node_modules/vendor')).toBe('1.0.0')
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('additional manifests participate in changed-package dependency propagation', () => {
  const root = fixture()
  try {
    run(root, ['git', 'init', '--quiet'])
    run(root, ['git', 'add', '.'])
    run(root, ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'baseline'])
    run(root, ['git', 'tag', 'v1.0.0'])
    writeFileSync(join(root, 'packages/runtime/index.ts'), 'export const updated = true\n')
    run(root, ['git', 'add', 'packages/runtime/index.ts'])
    run(root, ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'change runtime'])
    bump(root, ['--only-changed-since', 'v1.0.0'])
    for (const path of ['.', 'packages/runtime', 'packages/vscode'])
      expect(version(root, path)).toBe('1.0.1')
    expect(version(root, 'packages/unchanged')).toBe('1.0.0')
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})
