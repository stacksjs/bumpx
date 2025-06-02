import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export default async function (
  op: 'install' | 'uninstall',
  { dryrun }: { dryrun: boolean },
): Promise<void> {
  let opd_at_least_once = false

  const shellFiles = getShellFiles()

  for (const [file, line] of shellFiles) {
    try {
      let content = ''
      if (existsSync(file)) {
        content = readFileSync(file, 'utf8')
      }

      const hasHook = content.includes('# https://github.com/pkgxdev/dev')

      if (op === 'install') {
        if (hasHook) {
          console.error('hook already integrated:', file)
          continue
        }

        if (!dryrun) {
          const newContent = content.endsWith('\n') ? content : `${content}\n`
          writeFileSync(file, `${newContent}\n${line}  # https://github.com/pkgxdev/dev\n`)
        }

        opd_at_least_once = true
        console.error(`${file} << \`${line}\``)
      }
      else if (op === 'uninstall') {
        if (!hasHook) {
          continue
        }

        const lines = content.split('\n')
        const filteredLines = lines.filter(line => !line.includes('# https://github.com/pkgxdev/dev'))

        if (!dryrun) {
          writeFileSync(file, filteredLines.join('\n'))
        }

        opd_at_least_once = true
        console.error('removed hook:', file)
      }
    }
    catch (error) {
      console.error(`Failed to process ${file}:`, error instanceof Error ? error.message : error)
    }
  }

  if (dryrun && opd_at_least_once) {
    console.error(
      '%cthis was a dry-run. %cnothing was changed.',
      'color: #5f5fff',
      'color: initial',
    )
  }
  else {
    switch (op) {
      case 'uninstall':
        if (!opd_at_least_once) {
          console.error('nothing to deintegrate found')
        }
        break
      case 'install':
        if (opd_at_least_once) {
          // eslint-disable-next-line no-console
          console.log(
            'now %crestart your terminal%c for `dev` hooks to take effect',
            'color: #5f5fff',
            'color: initial',
          )
        }
    }
  }
}

function getShellFiles(): [string, string][] {
  const eval_ln = existsSync('/opt/homebrew/bin/dev') || existsSync('/usr/local/bin/dev')
    ? 'eval "$(dev --shellcode)"'
    : existsSync('/usr/local/bin/launchpad')
      ? 'eval "$(launchpad dev:shellcode)"'
      : 'eval "$(pkgx --quiet dev --shellcode)"'

  const home = homedir()
  const zdotdir = process.env.ZDOTDIR || home
  const zshpair: [string, string] = [join(zdotdir, '.zshrc'), eval_ln]

  const candidates: [string, string][] = [
    zshpair,
    [join(home, '.bashrc'), eval_ln],
    [join(home, '.bash_profile'), eval_ln],
  ]

  const viable_candidates = candidates.filter(([file]) => existsSync(file))

  if (viable_candidates.length === 0) {
    if (platform() === 'darwin') {
      // macOS has no .zshrc by default and we want mac users to get a just works experience
      return [zshpair]
    }
    else {
      console.error('no `.shellrc` files found')
      process.exit(1)
    }
  }

  return viable_candidates
}
