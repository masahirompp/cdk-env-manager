import * as cdk from '@aws-cdk/core'
import {
  CdkDeployParameters,
  ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY,
  loadCdkDeployParametersFromLocal
} from './CdkUtils'

export abstract class CdkAppBase<
  T extends CdkDeployParameters = CdkDeployParameters
> extends cdk.App {
  protected readonly cdkEnvKey: string
  protected readonly deployParameters: T
  constructor(protected props?: cdk.AppProps) {
    super(props)
    this.cdkEnvKey = process.env[ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]!
    if (!this.cdkEnvKey) {
      throw Error(`Environment Variable not found: ${ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY}`)
    }
    this.deployParameters = loadCdkDeployParametersFromLocal(this.cdkEnvKey)
    this.createStacks()
  }

  protected abstract createStacks(): void
}
