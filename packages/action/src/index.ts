import type { ActionInputs, InstallationSummary, PackageInstallResult } from './types'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import { ActionError, ActionErrorType } from './types'

export * from './types'

const DEFAULT_TIMEOUT = 600 // 10 minutes

/**
 * Main function to run the GitHub Action
 */
export async function run(): Promise<void> {
  const startTime = Date.now()
  const summary: InstallationSummary = {
    totalPackages: 0,
    successfulInstalls: 0,
    failedInstalls: 0,
    results: [],
    totalTime: 0,
    bumpxInstalled: false,
    bunInstalled: false,
    pkgxInstalled: false,
  }

  try {
    // Get and validate inputs
    const inputs = getActionInputs()
    core.info('Starting bumpx Installer Action')

    if (inputs.verbose) {
      core.info(`Inputs: ${JSON.stringify(inputs, null, 2)}`)
      core.info(`Context: ${JSON.stringify(github.context, null, 2)}`)
    }

    // Set working directory if specified
    if (inputs.workingDirectory && inputs.workingDirectory !== '.') {
      process.chdir(inputs.workingDirectory)
      core.info(`Changed working directory to: ${inputs.workingDirectory}`)
    }

    // Setup environment variables
    if (inputs.envVars) {
      setupEnvironmentVariables(inputs.envVars)
    }

    // Setup Bun if requested
    if (inputs.installBun) {
      const bunResult = await setupBun()
      summary.bunInstalled = bunResult.success
      if (!bunResult.success) {
        throw new ActionError(
          `Bun installation failed: ${bunResult.error}`,
          ActionErrorType.BUN_INSTALLATION_FAILED,
          { error: bunResult.error },
        )
      }
    }

    // Install bumpx
    const bumpxResult = await installBumpx(inputs.bumpxVersion)
    summary.bumpxInstalled = bumpxResult.success
    if (!bumpxResult.success) {
      throw new ActionError(
        `bumpx installation failed: ${bumpxResult.error}`,
        ActionErrorType.BUMPX_INSTALLATION_FAILED,
        { error: bumpxResult.error, version: inputs.bumpxVersion },
      )
    }

    // Install pkgx if requested
    if (inputs.installPkgx) {
      const pkgxResult = await installPkgx(inputs.verbose)
      summary.pkgxInstalled = pkgxResult.success
      if (!pkgxResult.success) {
        core.warning(`pkgx installation failed: ${pkgxResult.error}`)
      }
    }

    // Install specified packages
    if (inputs.packages) {
      const packagesToInstall = inputs.packages.split(/\s+/).filter(Boolean)
      if (packagesToInstall.length > 0) {
        const installResults = await installPackages(packagesToInstall, inputs.timeout, inputs.verbose)
        summary.results = installResults
        summary.totalPackages = installResults.length
        summary.successfulInstalls = installResults.filter(r => r.success).length
        summary.failedInstalls = installResults.filter(r => !r.success).length
      }
    }

    // Calculate total time
    summary.totalTime = Date.now() - startTime

    // Set outputs
    setActionOutputs(summary, bumpxResult.version)

    // Log summary
    logInstallationSummary(summary)

    core.info(`bumpx installation completed successfully in ${summary.totalTime}ms`)
  }
  catch (error) {
    summary.totalTime = Date.now() - startTime
    handleActionError(error, summary)
  }
}

/**
 * Get and validate action inputs
 */
function getActionInputs(): ActionInputs {
  const inputs: ActionInputs = {
    packages: core.getInput('packages', { required: false }) || '',
    configPath: core.getInput('config-path', { required: false }) || 'bumpx.config.ts',
    bumpxVersion: core.getInput('bumpx-version', { required: false }) || 'latest',
    installBun: core.getBooleanInput('install-bun', { required: false }) ?? true,
    installPkgx: core.getBooleanInput('install-pkgx', { required: false }) ?? true,
    verbose: core.getBooleanInput('verbose', { required: false }) ?? false,
    skipDetection: core.getBooleanInput('skip-detection', { required: false }) ?? false,
    workingDirectory: core.getInput('working-directory', { required: false }) || '.',
    envVars: core.getInput('env-vars', { required: false }) || '',
    timeout: Number.parseInt(core.getInput('timeout', { required: false }) || String(DEFAULT_TIMEOUT)),
    cache: core.getBooleanInput('cache', { required: false }) ?? true,
    cacheKey: core.getInput('cache-key', { required: false }) || 'bumpx-packages',
  }

  // Validate inputs
  if (inputs.timeout <= 0 || inputs.timeout > 3600) {
    throw new ActionError(
      `Invalid timeout: ${inputs.timeout}. Must be between 1 and 3600 seconds.`,
      ActionErrorType.CONFIG_PARSING_FAILED,
      { timeout: inputs.timeout },
    )
  }

  return inputs
}

/**
 * Setup environment variables from JSON string
 */
function setupEnvironmentVariables(envVarsJson: string): void {
  try {
    const envVars = JSON.parse(envVarsJson)
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = String(value)
      core.info(`Set environment variable: ${key}`)
    })
  }
  catch (error) {
    throw new ActionError(
      `Failed to parse env-vars JSON: ${error}`,
      ActionErrorType.CONFIG_PARSING_FAILED,
      { envVarsJson, error },
    )
  }
}

/**
 * Setup Bun in the environment
 */
async function setupBun(): Promise<PackageInstallResult> {
  const startTime = Date.now()
  core.info('Setting up Bun...')

  try {
    // Check if Bun is already installed
    const { exitCode } = await exec.getExecOutput('which', ['bun'], { ignoreReturnCode: true })

    if (exitCode === 0) {
      core.info('Bun is already installed')
      const { stdout } = await exec.getExecOutput('bun', ['--version'])
      const version = stdout.trim()

      return {
        name: 'bun',
        success: true,
        installTime: Date.now() - startTime,
        version,
      }
    }

    core.info('Bun is not installed, installing now...')

    // Install Bun based on platform
    const platform = process.platform

    if (platform === 'darwin' || platform === 'linux') {
      // macOS or Linux
      await exec.exec('curl', ['-fsSL', 'https://bun.sh/install', '|', 'bash'], {
        env: { ...process.env, FORCE: '1' },
      })
    }
    else if (platform === 'win32') {
      // Windows
      await exec.exec('powershell', ['-Command', 'irm bun.sh/install.ps1 | iex'])
    }
    else {
      throw new ActionError(
        `Unsupported platform: ${platform}`,
        ActionErrorType.UNSUPPORTED_PLATFORM,
        { platform },
      )
    }

    // Add Bun to PATH
    const bunPath = path.join(os.homedir(), '.bun', 'bin')
    core.addPath(bunPath)

    // Verify installation
    const { stdout } = await exec.getExecOutput('bun', ['--version'])
    const version = stdout.trim()

    core.info(`Bun installation completed: ${version}`)

    return {
      name: 'bun',
      success: true,
      installTime: Date.now() - startTime,
      version,
    }
  }
  catch (error) {
    return {
      name: 'bun',
      success: false,
      installTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Install bumpx using Bun
 */
async function installBumpx(version: string): Promise<PackageInstallResult> {
  const startTime = Date.now()
  core.info(`Installing bumpx version: ${version}`)

  try {
    const packageSpec = version === 'latest' ? 'bumpx' : `bumpx@${version}`
    await exec.exec('bun', ['install', '-g', packageSpec])

    // Verify installation
    const { stdout } = await exec.getExecOutput('bumpx', ['--version'], { ignoreReturnCode: true })
    const installedVersion = stdout.trim()

    core.info(`bumpx installation completed: ${installedVersion}`)

    return {
      name: 'bumpx',
      success: true,
      installTime: Date.now() - startTime,
      version: installedVersion,
    }
  }
  catch (error) {
    return {
      name: 'bumpx',
      success: false,
      installTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Install pkgx using bumpx
 */
async function installPkgx(verbose: boolean): Promise<PackageInstallResult> {
  const startTime = Date.now()
  core.info('Installing pkgx...')

  try {
    const options = {
      env: {
        ...process.env,
        bumpx_VERBOSE: verbose ? 'true' : 'false',
        CONTEXT: JSON.stringify(github.context),
      },
    }

    const args = ['pkgx']
    if (verbose) {
      args.push('--verbose')
    }

    await exec.exec('bumpx', args, options)
    core.info('pkgx installation completed')

    return {
      name: 'pkgx',
      success: true,
      installTime: Date.now() - startTime,
    }
  }
  catch (error) {
    return {
      name: 'pkgx',
      success: false,
      installTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Install multiple packages
 */
async function installPackages(packages: string[], timeout: number, verbose: boolean): Promise<PackageInstallResult[]> {
  core.info(`Installing ${packages.length} packages: ${packages.join(', ')}`)

  const results: PackageInstallResult[] = []

  for (const packageName of packages) {
    const result = await installSinglePackage(packageName, timeout, verbose)
    results.push(result)

    if (result.success) {
      core.info(`✓ ${packageName} installed successfully`)
    }
    else {
      core.warning(`✗ ${packageName} installation failed: ${result.error}`)
    }
  }

  return results
}

/**
 * Install a single package
 */
async function installSinglePackage(packageName: string, timeout: number, verbose: boolean): Promise<PackageInstallResult> {
  const startTime = Date.now()

  try {
    const options = {
      env: {
        ...process.env,
        bumpx_VERBOSE: verbose ? 'true' : 'false',
        CONTEXT: JSON.stringify(github.context),
      },
      timeout: timeout * 1000, // Convert to milliseconds
    }

    const args = ['install']
    if (verbose) {
      args.push('--verbose')
    }
    args.push(packageName)

    await exec.exec('bumpx', args, options)

    return {
      name: packageName,
      success: true,
      installTime: Date.now() - startTime,
    }
  }
  catch (error) {
    return {
      name: packageName,
      success: false,
      installTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Set action outputs
 */
function setActionOutputs(summary: InstallationSummary, bumpxVersion?: string): void {
  core.setOutput('success', 'true')
  core.setOutput('packages-installed', String(summary.successfulInstalls))
  core.setOutput('installed-packages', JSON.stringify(summary.results.filter(r => r.success).map(r => r.name)))
  core.setOutput('summary', JSON.stringify(summary))
  core.setOutput('bumpx-version', bumpxVersion || 'unknown')
  core.setOutput('bun-version', summary.results.find(r => r.name === 'bun')?.version || 'unknown')
  core.setOutput('pkgx-installed', String(summary.pkgxInstalled))
}

/**
 * Log installation summary
 */
function logInstallationSummary(summary: InstallationSummary): void {
  core.info('='.repeat(50))
  core.info('Installation Summary')
  core.info('='.repeat(50))
  core.info(`Total packages: ${summary.totalPackages}`)
  core.info(`Successful installations: ${summary.successfulInstalls}`)
  core.info(`Failed installations: ${summary.failedInstalls}`)
  core.info(`Total time: ${summary.totalTime}ms`)
  core.info(`bumpx installed: ${summary.bumpxInstalled}`)
  core.info(`Bun installed: ${summary.bunInstalled}`)
  core.info(`pkgx installed: ${summary.pkgxInstalled}`)

  if (summary.failedInstalls > 0) {
    core.info('Failed installations:')
    summary.results.filter(r => !r.success).forEach((result) => {
      core.info(`  - ${result.name}: ${result.error}`)
    })
  }
  core.info('='.repeat(50))
}

/**
 * Handle action errors
 */
function handleActionError(error: unknown, summary: InstallationSummary): void {
  const errorMessage = error instanceof Error ? error.message : String(error)

  if (error instanceof ActionError) {
    core.error(`Action failed: ${error.message}`)
    core.error(`Error type: ${error.type}`)
    if (error.details) {
      core.error(`Details: ${JSON.stringify(error.details, null, 2)}`)
    }
  }
  else {
    core.error(`Unexpected error: ${errorMessage}`)
  }

  // Set failure outputs
  core.setOutput('success', 'false')
  core.setOutput('summary', JSON.stringify(summary))

  core.setFailed(errorMessage)
}

// Run the action if this is the main module
if (require.main === module) {
  run().catch((error) => {
    core.setFailed(error instanceof Error ? error.message : String(error))
  })
}
