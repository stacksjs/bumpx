/**
 * Input parameters for the bumpx-installer GitHub Action
 */
export interface ActionInputs {
  /**
   * Space-separated list of packages to install
   */
  packages: string

  /**
   * Path to bumpx config file
   */
  configPath: string
}
