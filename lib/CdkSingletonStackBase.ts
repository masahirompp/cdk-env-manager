import * as cdk from '@aws-cdk/core'
import { CdkAppBase } from './CdkAppBase'
import { createCdkSsmStringParameter, SINGLETON_PREFIX, TAG_NAME_CDK_ENV_KEY } from './CdkUtils'

export abstract class CdkSingletonStackBase<
  Props extends {} = {},
  Exports extends {} = {}
> extends cdk.Stack {
  readonly exports: Exports

  constructor(
    scope: CdkAppBase,
    stackName: string,
    protected props: Props,
    protected stackProps?: Omit<cdk.StackProps, 'stackName'>
  ) {
    super(scope, stackName, stackProps)
    this.tags.setTag(TAG_NAME_CDK_ENV_KEY, `${SINGLETON_PREFIX}${stackName}`)

    this.exports = this.createResources()
  }

  protected createOutputsSsmParameters<T extends { [key: string]: string }>(outputs: T) {
    Object.entries(outputs).map(([name, value]) =>
      createCdkSsmStringParameter(this, { cdkEnvKey: this.stackName, name, value })
    )
  }

  protected abstract createResources(): Exports
}
