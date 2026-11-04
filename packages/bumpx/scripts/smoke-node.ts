#!/usr/bin/env bun
/**
 * Smoke-test the published bin on Node.
 *
 * `bin/cli.js` ships with `#!/usr/bin/env node`, so every npm install runs
 * bumpx on Node while the whole test suite runs it on Bun. Nothing used to
 * exercise that gap, which is how #2013 shipped: `import * as process from
 * 'node:process'` gives an ESM namespace without the EventEmitter methods
 * under Node, so `process.on` was undefined and any release died on
 * `TypeError: ... .on is not a function`.
 *
 * A startup check would not have caught it — `node dist/bin/cli.js --version`
 * exits 0 with that bug present, because the call that fails lives in the
 * release path. So this performs a real bump and checks the file changed.
 *
 * Run it with `bun run smoke:node`, after a build.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

const cli = resolve(import.meta.dir, '../dist/bin/cli.js')

const failures: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  ok  ${name}`)
    return
  }
  console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`)
  failures.push(name)
}

function run(args: string[], cwd: string): { code: number, output: string } {
  const result = spawnSync('node', [cli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
      TMPDIR: cwd,
      GIT_TERMINAL_PROMPT: '0',
    },
  })
  return {
    code: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

// Unlike the test suite, this is a gate: a missing build or a missing Node is
// the thing it exists to notice, so neither is allowed to pass quietly.
if (!existsSync(cli)) {
  console.error(`No build at ${cli}. Run \`bun run build\` first.`)
  process.exit(1)
}

const nodeVersion = spawnSync('node', ['--version'], { encoding: 'utf8' })
if (nodeVersion.status !== 0) {
  console.error('Node is not on PATH. The published bin runs on node, so this check needs it.')
  process.exit(1)
}

console.log(`Smoke-testing ${cli}`)
console.log(`           on node ${nodeVersion.stdout.trim()}\n`)

const workspace = mkdtempSync(join(tmpdir(), 'bumpx-smoke-node-'))

try {
  writeFileSync(
    join(workspace, 'package.json'),
    `${JSON.stringify({ name: 'smoke', version: '1.0.0' }, null, 2)}\n`,
  )
  for (const args of [
    ['init', '-q', '.'],
    ['add', '-A'],
    ['-c', 'user.email=smoke@example.com', '-c', 'user.name=smoke', 'commit', '-qm', 'init'],
  ]) {
    const git = spawnSync('git', args, { cwd: workspace, encoding: 'utf8' })
    if (git.status !== 0)
      throw new Error(`git ${args.join(' ')} failed: ${git.stderr}`)
  }

  const version = run(['--version'], workspace)
  check('--version exits 0', version.code === 0, version.output.trim())

  const help = run(['--help'], workspace)
  check('--help exits 0', help.code === 0, help.output.trim())

  // The one that matters: a real bump, all the way through the release path.
  const bump = run(
    ['patch', '--no-commit', '--no-tag', '--no-push', '--no-changelog', '--no-git-check'],
    workspace,
  )
  check('a release runs without a TypeError', !bump.output.includes('is not a function'), bump.output.trim())
  check('a release exits 0', bump.code === 0, bump.output.trim())

  const bumped = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8')) as { version: string }
  check('the version was written', bumped.version === '1.0.1', `version is ${bumped.version}, expected 1.0.1`)
}
finally {
  rmSync(workspace, { recursive: true, force: true })
}

console.log('')
if (failures.length > 0) {
  console.error(`${failures.length} smoke check(s) failed on node: ${failures.join(', ')}`)
  console.error(`The bin ships with a node shebang (${join(dirname(cli), 'cli.js')}), so this is what an npm install runs.`)
  process.exit(1)
}

console.log('All node smoke checks passed.')
