import * as cdk from '@aws-cdk/core'
import { CdkAppBase } from './CdkAppBase'
import { createCdkSsmStringParameter, getTagNameCdkEnvKey, SINGLETON_PREFIX } from './CdkUtils'

export abstract class CdkSingletonStackBase<
  Props extends {} = {},
  Exports extends {} = {}
> extends cdk.Stack {
  readonly exports: Exports
  readonly __appKey: string

  constructor(
    scope: CdkAppBase,
    stackName: string,
    protected props: Props,
    protected stackProps?: Omit<cdk.StackProps, 'stackName'>
  ) {
    super(scope, `${scope.__appKey}${stackName}`, stackProps)
    this.tags.setTag(
      getTagNameCdkEnvKey(scope.__appKey),
      `${scope.__appKey}${SINGLETON_PREFIX}${stackName}`
    )
    this.__appKey = scope.__appKey

    this.exports = this.createResources()
  }

  protected name(name: string) {
    return `${this.__appKey}${name}`
  }

  protected createOutputsSsmParameters<T extends { [key: string]: string }>(outputs: T) {
    Object.entries(outputs).map(([name, value]) =>
      createCdkSsmStringParameter(this, {
        cdkAppKey: this.__appKey,
        cdkEnvKey: this.stackName,
        name,
        value,
      })
    )
  }

  protected abstract createResources(): Exports
}
