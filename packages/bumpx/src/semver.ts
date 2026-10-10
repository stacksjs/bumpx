/** Semantic versions and release operations, independent of Git and file I/O. */
export class SemVer {
  major: number
  minor: number
  patch: number
  prerelease: string[]
  build: string[]
  version: string

  constructor(version: string) {
    version = version.replace(/^v/, '')
    const match = version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*))*))?(?:\+([0-9a-z-]+(?:\.[0-9a-z-]+)*))?$/i)
    if (!match) throw new Error(`Invalid version: ${version}`)
    this.major = Number(match[1])
    this.minor = Number(match[2])
    this.patch = Number(match[3])
    if (![this.major, this.minor, this.patch].every(Number.isSafeInteger))
      throw new Error(`Invalid version: ${version} exceeds safe integer precision`)
    this.prerelease = match[4]?.split('.') ?? []
    this.build = match[5]?.split('.') ?? []
    this.version = version
  }

  /** Return a new version; repeated calculations never mutate their input. */
  inc(release: string, preid?: string): SemVer {
    const next = new SemVer(this.toString())
    const wasPrerelease = next.prerelease.length > 0
    if (['premajor', 'preminor', 'prepatch', 'prerelease', 'pre'].includes(release) && preid !== undefined) {
      // Validate every segment before writing a version or switching channels.
      if (!preid) throw new Error('Prerelease identifier cannot be empty')
      new SemVer(`0.0.0-${preid}`)
    }
    const startPre = () => { next.prerelease = [...(preid ?? 'alpha').split('.'), '0'] }
    const advancePre = () => {
      const prefix = preid?.split('.')
      if (!next.prerelease.length || (prefix && (prefix.some((part, index) => next.prerelease[index] !== part) || !/^\d+$/.test(next.prerelease[prefix.length] ?? '')))) startPre()
      else next.prerelease = incrementIdentifiers(next.prerelease, '0')
    }
    switch (release) {
      case 'major':
        if (!wasPrerelease || next.minor !== 0 || next.patch !== 0) next.major++
        next.minor = 0
        next.patch = 0
        next.prerelease = []
        break
      case 'minor':
        if (!wasPrerelease || next.patch !== 0) next.minor++
        next.patch = 0
        next.prerelease = []
        break
      case 'patch':
        if (!wasPrerelease) next.patch++
        next.prerelease = []
        break
      case 'premajor':
        next.major++
        next.minor = 0
        next.patch = 0
        startPre()
        break
      case 'preminor':
        next.minor++
        next.patch = 0
        startPre()
        break
      case 'prepatch':
        next.patch++
        startPre()
        break
      case 'prerelease':
        if (!wasPrerelease) next.patch++
        advancePre()
        break
      case 'pre':
        // Test the current target (e.g. 1.0.0) without moving to 1.0.1.
        advancePre()
        break
      case 'release':
        if (!wasPrerelease) throw new Error(`${this} is already a stable release`)
        next.prerelease = []
        break
      case 'build':
        next.build = next.build.length ? incrementIdentifiers(next.build, '1') : ['build', '1']
        return new SemVer(next.toString())
      default:
        throw new Error(`Invalid release type: ${release}`)
    }
    next.build = []
    return new SemVer(next.toString())
  }

  /** Serialize the full version; metadata is ignored by precedence, not output. */
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}${this.prerelease.length ? `-${this.prerelease.join('.')}` : ''}${this.build.length ? `+${this.build.join('.')}` : ''}`
  }
}

function incrementIdentifiers(parts: string[], initial: string): string[] {
  const next = [...parts]
  for (let index = next.length - 1; index >= 0; index--) {
    if (/^\d+$/.test(next[index])) {
      next[index] = String(BigInt(next[index]) + 1n)
      return next
    }
  }
  return [...next, initial]
}

/** A platform's separate build counter, including previously allocated runs. */
export function nextBuildNumber(current: number, allocated: readonly number[] = []): number {
  const numbers = [current, ...allocated]
  if (!numbers.every(number => Number.isSafeInteger(number) && number >= 0))
    throw new Error('Build numbers must be non-negative safe integers')
  const next = numbers.reduce((maximum, number) => Math.max(maximum, number), 0) + 1
  if (!Number.isSafeInteger(next)) throw new Error('Build number exceeds safe integer precision')
  return next
}
