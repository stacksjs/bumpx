/**
 * Input parameters for the bumpx-installer GitHub Action
 */
export interface ActionInputs {
  /**
   * Space-separated list of packages to install
   * Example: "typescript eslint prettier"
   */
  packages: string

  /**
   * Path to bumpx config file
   * Default: "bumpx.config.ts"
   */
  configPath: string

  /**
   * Version of bumpx to install
   * Default: "latest"
   */
  bumpxVersion: string

  /**
   * Whether to install Bun if not already present
   * Default: true
   */
  installBun: boolean

  /**
   * Whether to install pkgx
   * Default: true
   */
  installPkgx: boolean

  /**
   * Whether to enable verbose logging
   * Default: false
   */
  verbose: boolean

  /**
   * Whether to skip dependency detection and only install specified packages
   * Default: false
   */
  skipDetection: boolean

  /**
   * Working directory for package installation
   * Default: current directory
   */
  workingDirectory: string

  /**
   * Additional environment variables to set during installation
   * JSON string format: '{"VAR1": "value1", "VAR2": "value2"}'
   */
  envVars: string

  /**
   * Timeout for installation commands in seconds
   * Default: 600 (10 minutes)
   */
  timeout: number

  /**
   * Whether to cache installed packages
   * Default: true
   */
  cache: boolean

  /**
   * Cache key prefix for package caching
   * Default: "bumpx-packages"
   */
  cacheKey: string
}

/**
 * Results from dependency detection
 */
export interface DependencyDetectionResult {
  /**
   * List of detected dependencies
   */
  dependencies: string[]

  /**
   * Sources where dependencies were found
   */
  sources: DependencySource[]

  /**
   * Total number of dependencies detected
   */
  count: number

  /**
   * Time taken for detection in milliseconds
   */
  detectionTime: number
}

/**
 * Source of detected dependencies
 */
export interface DependencySource {
  /**
   * Type of source (e.g., 'package.json', 'config', 'lockfile')
   */
  type: string

  /**
   * File path of the source
   */
  file: string

  /**
   * Dependencies found in this source
   */
  dependencies: string[]
}

/**
 * Installation result for a package
 */
export interface PackageInstallResult {
  /**
   * Package name
   */
  name: string

  /**
   * Whether installation was successful
   */
  success: boolean

  /**
   * Error message if installation failed
   */
  error?: string

  /**
   * Installation time in milliseconds
   */
  installTime: number

  /**
   * Version that was installed
   */
  version?: string
}

/**
 * Overall installation summary
 */
export interface InstallationSummary {
  /**
   * Total packages attempted
   */
  totalPackages: number

  /**
   * Successfully installed packages
   */
  successfulInstalls: number

  /**
   * Failed installations
   */
  failedInstalls: number

  /**
   * Individual package results
   */
  results: PackageInstallResult[]

  /**
   * Total installation time in milliseconds
   */
  totalTime: number

  /**
   * Whether bumpx was installed successfully
   */
  bumpxInstalled: boolean

  /**
   * Whether Bun was installed successfully
   */
  bunInstalled: boolean

  /**
   * Whether pkgx was installed successfully
   */
  pkgxInstalled: boolean
}

/**
 * Action outputs that will be set
 */
export interface ActionOutputs {
  /**
   * Whether the action completed successfully
   */
  success: string

  /**
   * Number of packages installed
   */
  packagesInstalled: string

  /**
   * List of installed packages (JSON string)
   */
  installedPackages: string

  /**
   * Installation summary (JSON string)
   */
  summary: string

  /**
   * Detected dependencies (JSON string)
   */
  detectedDependencies: string

  /**
   * Version of bumpx that was installed
   */
  bumpxVersion: string

  /**
   * Version of Bun that was installed or detected
   */
  bunVersion: string

  /**
   * Whether pkgx was successfully installed
   */
  pkgxInstalled: string
}

/**
 * Error types that can occur during action execution
 */
export enum ActionErrorType {
  BUN_INSTALLATION_FAILED = 'BUN_INSTALLATION_FAILED',
  BUMPX_INSTALLATION_FAILED = 'BUMPX_INSTALLATION_FAILED',
  PKGX_INSTALLATION_FAILED = 'PKGX_INSTALLATION_FAILED',
  PACKAGE_INSTALLATION_FAILED = 'PACKAGE_INSTALLATION_FAILED',
  DEPENDENCY_DETECTION_FAILED = 'DEPENDENCY_DETECTION_FAILED',
  CONFIG_PARSING_FAILED = 'CONFIG_PARSING_FAILED',
  TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
  UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Custom error class for action errors
 */
export class ActionError extends Error {
  constructor(
    message: string,
    public type: ActionErrorType,
    public details: Record<string, any> | undefined = undefined,
  ) {
    super(message)
    this.name = 'ActionError'
  }
}
