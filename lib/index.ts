import {
  ENVIRONMENT_VARIABLE_NAME_CDK_APP_KEY,
  ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY,
  getStackParameters,
} from './CdkUtils'

export * from './CdkAppBase'
export * from './CdkStackBase'
export * from './CdkSingletonStackBase'

export const loadStackParameters = () => {
  const cdkAppKey = process.env[ENVIRONMENT_VARIABLE_NAME_CDK_APP_KEY] || ''
  const cdkEnvKey = process.env[ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]
  if (!cdkEnvKey) {
    throw Error(`Environment Variable not found: ${ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY}`)
  }

  // load stack parameters from ssm
  return getStackParameters(cdkAppKey, cdkEnvKey)
}
