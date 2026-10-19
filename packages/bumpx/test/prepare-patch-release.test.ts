import { expect, test } from 'bun:test'
import { nextPatchVersion, requireQualifiedSourceCi, requireReleaseIdentity } from '../../../.github/scripts/prepare-patch-release'

const source = 'a'.repeat(40)
const run = { id: 1, name: 'CI', head_sha: source, status: 'completed', conclusion: 'success' }
const names = ['lint', 'typecheck', 'test', 'publish-commit']
const complete = () => ({ total_count: 4, jobs: names.map(name => ({ name, status: 'completed', conclusion: 'success' })) })

test('the patch producer requires every completed source gate on the exact source', () => {
  expect(() => requireQualifiedSourceCi(source, run, complete())).not.toThrow()
  for (const change of [{ head_sha: 'b'.repeat(40) }, { name: 'CI Failure Issue' }, { status: 'in_progress' }, { conclusion: 'failure' }])
    expect(() => requireQualifiedSourceCi(source, { ...run, ...change }, complete())).toThrow()
})

test('a green workflow cannot hide missing publication gate, failed preview or partial job results', () => {
  for (const name of ['lint', 'typecheck', 'test', 'publish-commit']) {
    const jobs = complete()
    jobs.jobs.find(job => job.name === name)!.conclusion = 'failure'
    expect(() => requireQualifiedSourceCi(source, run, jobs)).toThrow()
  }
  const missing = complete()
  missing.jobs = missing.jobs.filter(job => job.name !== 'publish-commit')
  expect(() => requireQualifiedSourceCi(source, run, missing)).toThrow()
  const skipped = complete()
  skipped.jobs.find(job => job.name === 'publish-commit')!.conclusion = 'skipped'
  expect(() => requireQualifiedSourceCi(source, run, skipped)).toThrow()
})

test('an unused failure alert may be skipped after all four required checks pass', () => {
  const jobs = complete()
  jobs.jobs.push({ name: 'alert-on-failure', status: 'completed', conclusion: 'skipped' })
  jobs.total_count += 1
  expect(() => requireQualifiedSourceCi(source, run, jobs)).not.toThrow()
})

test('release identity is Chris Breuer and the commit has no coauthor trailer', () => {
  const identity = 'Chris Breuer|chrisbreuer93@gmail.com|Chris Breuer|chrisbreuer93@gmail.com'
  expect(() => requireReleaseIdentity(identity, 'chore: release v0.2.25')).not.toThrow()
  expect(() => requireReleaseIdentity(identity.replaceAll('Chris Breuer', 'github-actions[bot]'), 'chore: release v0.2.25')).toThrow()
  expect(() => requireReleaseIdentity(identity, 'chore: release v0.2.25\n\nCo-authored-by: Agent <agent@example.invalid>')).toThrow()
})

test('patch calculation rejects ambiguous versions rather than choosing another release', () => {
  expect(nextPatchVersion('0.2.24')).toBe('0.2.25')
  for (const version of ['v0.2.24', '0.2.24-beta', '0.11', '', null, '0.2.9007199254740992'])
    expect(() => nextPatchVersion(version)).toThrow()
})
