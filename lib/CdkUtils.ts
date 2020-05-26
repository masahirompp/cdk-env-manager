import * as AwsCdkSsm from '@aws-cdk/aws-ssm'
import { Construct } from '@aws-cdk/core'
import { makeStackParameterPath } from './util'

export const createCdkSsmStringParameter = (
  scope: Construct,
  {
    cdkAppKey,
    cdkEnvKey,
    name,
    value,
  }: { cdkAppKey: string; cdkEnvKey: string; name: string; value: string }
) => {
  return new AwsCdkSsm.StringParameter(scope, name, {
    parameterName: makeStackParameterPath(cdkAppKey, cdkEnvKey, name),
    stringValue: value,
  })
}
