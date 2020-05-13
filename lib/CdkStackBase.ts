import * as cdk from '@aws-cdk/core'
import { CdkAppBase } from './CdkAppBase'
import { createCdkSsmStringParameter, getTagNameCdkEnvKey } from './CdkUtils'

export abstract class CdkStackBase<
  Props extends {} = {},
  Exports extends {} = {}
> extends cdk.Stack {
  readonly exports: Exports
  readonly __appKey: string
  readonly cdkEnvKey: string

  constructor(
    scope: CdkAppBase,
    stackName: string,
    protected props: Props,
    protected stackProps?: Omit<cdk.StackProps, 'stackName'>
  ) {
    super(scope, `${scope.__appKey}${scope.cdkEnvKey}${stackName}`, stackProps)
    this.name.bind(this)
    this.createOutputsSsmParameters.bind(this)

    this.tags.setTag(getTagNameCdkEnvKey(), scope.cdkEnvKey)

    this.__appKey = scope.__appKey
    this.cdkEnvKey = scope.cdkEnvKey
    this.exports = this.createResources()
  }

  protected name(name: string) {
    return `${this.__appKey}${this.cdkEnvKey}${name}`
  }

  protected createOutputsSsmParameters<T extends { [key: string]: string }>(outputs: T) {
    Object.entries(outputs).map(([name, value]) =>
      createCdkSsmStringParameter(this, { cdkEnvKey: this.cdkEnvKey, name, value })
    )
  }

  protected abstract createResources(): Exports
}
