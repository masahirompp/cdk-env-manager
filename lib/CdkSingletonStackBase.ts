import * as cdk from '@aws-cdk/core'
import { createCdkSsmStringParameter, TAG_NAME_CDK_ENV_KEY } from './CdkUtils'

export abstract class CdkSingletonStackBase<
  Props extends {} = {},
  Exports extends {} = {}
> extends cdk.Stack {
  readonly exports: Exports

  constructor(
    scope: cdk.Construct,
    protected props: { stackName: string } & Props,
    protected stackProps?: Omit<cdk.StackProps, 'stackName'>
  ) {
    super(scope, props.stackName, stackProps)
    this.tags.setTag(TAG_NAME_CDK_ENV_KEY, props.stackName)

    this.exports = this.createResources()
  }

  protected createOutputsSsmParameters<T extends { [key: string]: string }>(outputs: T) {
    Object.entries(outputs).map(([name, value]) =>
      createCdkSsmStringParameter(this, { cdkEnvKey: this.props.stackName, name, value })
    )
  }

  protected abstract createResources(): Exports
}
