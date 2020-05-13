import * as cdk from '@aws-cdk/core'
import {
  CdkDeployParameters,
  ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY,
  ENVIRONMENT_VARIABLE_NAME_TAG_NAME_CDK_ENV_KEY,
  loadCdkDeployParametersFromLocal,
} from './CdkUtils'

export abstract class CdkAppBase<
  T extends CdkDeployParameters = CdkDeployParameters
> extends cdk.App {
  readonly __appKey: string
  readonly cdkEnvKey: string
  protected readonly deployParameters: T
  constructor(protected props?: cdk.AppProps) {
    super(props)
    this.__appKey = process.env[ENVIRONMENT_VARIABLE_NAME_TAG_NAME_CDK_ENV_KEY] || ''
    this.cdkEnvKey = process.env[ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]!
    if (!this.cdkEnvKey) {
      throw Error(`Environment Variable not found: ${ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY}`)
    }
    this.deployParameters = loadCdkDeployParametersFromLocal(this.cdkEnvKey)
    this.createStacks()
  }

  protected abstract createStacks(): void
}
