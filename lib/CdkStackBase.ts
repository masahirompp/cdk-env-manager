import * as cdk from '@aws-cdk/core'
import { createCdkSsmStringParameter, TAG_NAME_CDK_ENV_KEY } from './CdkUtils'

export abstract class CdkStackBase<
  Props extends {} = {},
  Exports extends {} = {}
> extends cdk.Stack {
  readonly exports: Exports

  constructor(
    scope: cdk.Construct,
    protected props: { cdkEnvKey: string; stackName: string } & Props,
    protected stackProps?: cdk.StackProps
  ) {
    super(scope, `${props.cdkEnvKey}${props.stackName}`, stackProps)
    this.tags.setTag(TAG_NAME_CDK_ENV_KEY, props.cdkEnvKey)

    this.exports = this.createResources()
  }

  protected name(name: string) {
    return `${this.props.cdkEnvKey}${name}`
  }

  protected createOutputsSsmParameters<T extends { [key: string]: string }>(outputs: T) {
    Object.entries(outputs).map(([name, value]) =>
      createCdkSsmStringParameter(this, { cdkEnvKey: this.props.cdkEnvKey, name, value })
    )
  }

  protected abstract createResources(): Exports
}
