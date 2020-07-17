import ResourceGroupsTaggingAPI from 'aws-sdk/clients/resourcegroupstaggingapi'
import AwsSdkSsm from 'aws-sdk/clients/ssm'
import dotenv from 'dotenv'
import fs from 'fs'
import stringify from 'json-stringify-pretty-compact'
import { pascalCase } from 'pascal-case'
import path from 'path'

export type CdkDeployParameters = { [name: string]: string }

export const SKIP_DIFF_OPTION = '--skip-diff'
export const ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY = 'CDK_ENV_KEY'
export const ENVIRONMENT_VARIABLE_NAME_CDK_APP_KEY = 'CDK_APP_KEY'
export const SINGLETON_PREFIX = 'SINGLETON__'
export const CDK_DEPLOY_PARAMETERS_KEY = 'CdkDeployParametersString'
export const CDK_DEPLOY_DEFAULT_PARAMETERS_FILE_PATH = 'cdk.parameters.default.env'

export const makeStackParameterPath = (cdkAppKey: string, cdkEnvKey: string, ...paths: string[]) =>
  '/' + ['CDK', pascalCase(cdkAppKey), pascalCase(cdkEnvKey), ...paths].filter((s) => !!s).join('/')

const makeCdkDeployParametersFilePath = (cdkAppKey: string, cdkEnvKey: string) => {
  const cwd = process.cwd()
  const cdkJson = require(path.resolve(cwd, 'cdk.json'))
  return path.resolve(cwd, cdkJson.output || 'cdk.out', `${cdkAppKey}${cdkEnvKey}.parameters.json`)
}

export const loadStackParameters = () => {
  const cdkAppKey = process.env[ENVIRONMENT_VARIABLE_NAME_CDK_APP_KEY] || ''
  const cdkEnvKey = process.env[ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]
  if (!cdkEnvKey) {
    throw Error(`Environment Variable not found: ${ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY}`)
  }

  // load stack parameters from ssm
  return getStackParameters(cdkAppKey, cdkEnvKey)
}

const getStackParameters = async <T extends { [key: string]: string }>(
  cdkAppKey: string,
  cdkEnvKey: string,
  option?: AwsSdkSsm.Types.ClientConfiguration
) => {
  const parameterPath = makeStackParameterPath(cdkAppKey, cdkEnvKey) + '/'

  // ssmからAWSリソースの設定情報を取得
  const ssm = new AwsSdkSsm(option)
  const getParametersByPath: (nextToken?: string) => Promise<AwsSdkSsm.Parameter[]> = async (
    nextToken
  ) => {
    const ssmResult = await ssm
      .getParametersByPath({ Path: parameterPath, Recursive: true, NextToken: nextToken })
      .promise()
    if (ssmResult.NextToken) {
      return [...(ssmResult.Parameters || []), ...(await getParametersByPath(ssmResult.NextToken))]
    }
    return ssmResult.Parameters || []
  }
  const parameters = await getParametersByPath()

  // 取得したパラメータを整形
  const params = parameters.reduce<T>(
    (payload, p) => ({
      ...payload,
      [p.Name!.substring(parameterPath.length)]: p.Value,
    }),
    {} as any
  )
  return params
}

const getStackTagMappingList = async (
  cdkAppKey: string,
  options?: ResourceGroupsTaggingAPI.Types.ClientConfiguration
) => {
  const client = new ResourceGroupsTaggingAPI(options)
  const getStackTagMappingListPerPage: (
    paginationToken?: string
  ) => Promise<ResourceGroupsTaggingAPI.ResourceTagMappingList> = async (paginationToken) => {
    const result = await client
      .getResources({
        PaginationToken: paginationToken,
        TagFilters: [{ Key: getTagNameCdkEnvKey(cdkAppKey) }],
        ResourceTypeFilters: ['cloudformation:stack'],
      })
      .promise()
    if (result.PaginationToken) {
      return [
        ...(result.ResourceTagMappingList || []),
        ...(await getStackTagMappingListPerPage(result.PaginationToken)),
      ]
    }
    return result.ResourceTagMappingList || []
  }
  return getStackTagMappingListPerPage()
}

export const getTagNameCdkEnvKey = (cdkAppKey: string) => cdkAppKey || 'CdkEnvKey'

export const getStackNamesPerCdkEnvKey = async (
  cdkAppKey: string,
  options?: ResourceGroupsTaggingAPI.Types.ClientConfiguration
) => {
  const stackTagMappingList = await getStackTagMappingList(cdkAppKey, options)
  const stackNamesPerCdkEnvKey = stackTagMappingList.reduce<{ [cdkEnvKey: string]: string[] }>(
    (payload, stackTagMapping) => {
      const cdkEnvKey = stackTagMapping.Tags![0].Value
      if (!payload[cdkEnvKey]) {
        payload[cdkEnvKey] = []
      }
      // ResourceARN: 'arn:aws:cloudformation:ap-northeast-1:9999999999:stack/StackName/e53ede20-ff06-11e9-bc7e-999999999999'
      payload[cdkEnvKey].push(stackTagMapping.ResourceARN!.split('/')[1])
      return payload
    },
    {} as { [cdkEnvKey: string]: string[] }
  )
  return stackNamesPerCdkEnvKey
}

export const loadCdkDeployParametersDefault = () => {
  let defaultParameters = null
  if (!defaultParameters) {
    // 事前チェック：既定のパラメータファイルを取得
    const defaultParametersFilePath = path.resolve(
      process.cwd(),
      CDK_DEPLOY_DEFAULT_PARAMETERS_FILE_PATH
    )
    if (!fs.existsSync(defaultParametersFilePath)) {
      fs.writeFileSync(defaultParametersFilePath, '#REMOVAL_POLICY=retain', { encoding: 'utf8' })
      console.log(`file not found: ${defaultParametersFilePath}, created default parameter file.`)
    }
    defaultParameters = dotenv.config({ path: defaultParametersFilePath }).parsed || {}
  }
  return defaultParameters as CdkDeployParameters
}

export const loadCdkDeployParametersFromSsm: (
  cdkAppKey: string,
  cdkEnvKey: string,
  option?: AwsSdkSsm.Types.ClientConfiguration
) => Promise<CdkDeployParameters> = async (cdkAppKey, cdkEnvKey, option) => {
  const response = await new AwsSdkSsm(option)
    .getParameter({ Name: makeStackParameterPath(cdkAppKey, cdkEnvKey, CDK_DEPLOY_PARAMETERS_KEY) })
    .promise()
  return response.Parameter && response.Parameter.Value ? JSON.parse(response.Parameter.Value) : {}
}

export const loadCdkDeployParametersFromLocal = <
  T extends CdkDeployParameters = CdkDeployParameters
>(
  cdkAppKey: string,
  cdkEnvKey: string
) => require(makeCdkDeployParametersFilePath(cdkAppKey, cdkEnvKey)) as T

export const writeCdkDeployParametersToSsm = async (
  cdkAppKey: string,
  cdkEnvKey: string,
  deployParameters: CdkDeployParameters,
  overwrite: boolean,
  option?: AwsSdkSsm.Types.ClientConfiguration
) => {
  new AwsSdkSsm(option)
    .putParameter({
      Type: 'String',
      Overwrite: overwrite,
      Name: makeStackParameterPath(cdkAppKey, cdkEnvKey, CDK_DEPLOY_PARAMETERS_KEY),
      Value: JSON.stringify(deployParameters),
      Tags: overwrite ? undefined : [{ Key: getTagNameCdkEnvKey(cdkAppKey), Value: cdkEnvKey }],
    })
    .promise()
    .catch((e) => {
      if (e.code === 'ParameterAlreadyExists') {
        return writeCdkDeployParametersToSsm(cdkAppKey, cdkEnvKey, deployParameters, true, option)
      }
      return Promise.reject(e)
    })
}

export const writeCdkDeployParametersToLocal = (
  cdkAppKey: string,
  cdkEnvKey: string,
  deployParameters: CdkDeployParameters
) => {
  const filePath = makeCdkDeployParametersFilePath(cdkAppKey, cdkEnvKey)
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }
  fs.writeFileSync(filePath, stringify(deployParameters, { maxLength: 4 }), { encoding: 'utf8' })
}

export const mergeCdkDeployParameters = (
  defaultParameters: CdkDeployParameters,
  parameters: CdkDeployParameters
) => {
  const mergedParameters = Object.keys(defaultParameters).reduce<CdkDeployParameters>(
    (payload, key) => ({ ...payload, [key]: parameters[key] || defaultParameters[key] }),
    {}
  )
  return mergedParameters
}

export const diffCdkDeployParametersKeys = (a: CdkDeployParameters, b: CdkDeployParameters) => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  return !!(
    aKeys.filter((aKey) => !bKeys.includes(aKey)).length ||
    bKeys.filter((bKey) => !aKeys.includes(bKey)).length
  )
}
