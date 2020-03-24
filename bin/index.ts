#!/usr/bin/env node
import chalk from 'chalk'
import { execSync, spawn } from 'child_process'
import enquirer from 'enquirer'
import stringify from 'json-stringify-pretty-compact'
import { pascalCase } from 'pascal-case'
import {
  CdkDeployParameters,
  diffCdkDeployParametersKeys,
  ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY,
  SINGLETON_PREFIX,
  getStackNamesPerCdkEnvKey,
  loadCdkDeployParametersDefault,
  loadCdkDeployParametersFromSsm,
  mergeCdkDeployParameters,
  writeCdkDeployParametersToLocal,
  writeCdkDeployParametersToSsm,
} from '../lib/CdkUtils'

const { MultiSelect, Select, Input, Confirm, Snippet } = enquirer as any

const exec = (path: string, args: string[], env: any) => {
  console.log(chalk.blue([path, ...args].join(' ')))
  return new Promise<'success' | 'failed'>((resolve) => {
    const p = spawn(path, args, { stdio: 'inherit', env })
    p.on('close', (code) => {
      resolve(code === 0 ? 'success' : 'failed')
    })
  })
}

const selectCdkEnvKey = async (currentCdkEnvKeys: string[]) => {
  const NEW_STACK = '- create new Stacks -'

  const userSelected = await new Select({
    message: 'select CdkEnvKey to deploy',
    choices: [...currentCdkEnvKeys, NEW_STACK],
  }).run()

  const isNew = userSelected === NEW_STACK
  if (!isNew) {
    return { isNew, cdkEnvKey: userSelected }
  }

  const inputCdkEnvKey: (userInputCdkEnvKey?: string) => Promise<string> = async (
    userInputCdkEnvKey
  ) => {
    if (userInputCdkEnvKey) {
      if (currentCdkEnvKeys.includes(userInputCdkEnvKey)) {
        console.log(chalk.yellow(`CdkEnvKey [${userInputCdkEnvKey}] already exists`))
      } else {
        return userInputCdkEnvKey
      }
    }
    return inputCdkEnvKey(
      pascalCase(await new Input({ message: 'input CdkEnvKey', initial: 'Dev' }).run())
    )
  }

  return {
    isNew,
    cdkEnvKey: await inputCdkEnvKey(),
  }
}

const willChangeCdkDeployParameters: (
  defaultCdkDeployParameters: CdkDeployParameters,
  latestCdkDeployParameters: CdkDeployParameters
) => Promise<boolean> = async (defaultCdkDeployParameters, latestCdkDeployParameters) => {
  // SSMに保存されているパラメータと、デフォルトパラメータで、キーに差分があるか確認
  const diff = diffCdkDeployParametersKeys(defaultCdkDeployParameters, latestCdkDeployParameters)
  if (diff) {
    console.log(chalk.yellow('default parameters changed since the latest deployment.'))
    return true
  }

  const SHOW = 'show current parameters'
  const CHANGE = 'change parameters'
  const NO_CHANGE = 'no change'
  const userWillChange: () => Promise<boolean> = async () => {
    const userSelected = await new Select({
      message: 'change aws-cdk deploy parameters?',
      choices: [SHOW, CHANGE, NO_CHANGE],
    }).run()
    if (userSelected === SHOW) {
      console.log(stringify(latestCdkDeployParameters, { maxLength: 4 }))
      return userWillChange()
    }
    return userSelected === CHANGE
  }

  return userWillChange()
}

const inputCdkDeployParameters: (
  parameters: CdkDeployParameters
) => Promise<CdkDeployParameters> = async (parameters) => {
  const inputted = await new Snippet({
    message: 'configure aws-cdk App parameters',
    required: false,
    fields: Object.entries(parameters).map(([name, message]) => ({
      name,
      message,
    })),
    template: stringify(
      Object.keys(parameters).reduce((payload, key) => ({ ...payload, [key]: `\${${key}}` }), {}),
      { maxLength: 4 }
    ),
  }).run()
  const complementedParameters = mergeCdkDeployParameters(parameters, inputted.values)
  console.log(chalk.cyan(stringify(complementedParameters, { maxLength: 4 })))
  if (await new Confirm({ message: `OK?(Yes), or change parameters?(No)` }).run()) {
    return complementedParameters
  }
  return inputCdkDeployParameters(complementedParameters)
}

const run = async () => {
  console.log(chalk.green('AWS-CDK Deploy Tool Start.'))

  // https://github.com/aws/aws-sdk-js/issues/2929
  if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = process.env.AWS_DEFAULT_REGION
  }

  // AWSから現在デプロイ済みのStackを取得
  const stackNamesPerCdkEnvKey = await getStackNamesPerCdkEnvKey()

  // デプロイするStackを選択または入力させる
  const { isNew, cdkEnvKey } = await selectCdkEnvKey(
    Object.keys(stackNamesPerCdkEnvKey).filter((key) => !key.startsWith(SINGLETON_PREFIX))
  )

  // パラメータの確認（最新のパラメータは、SSMとローカルの両方に保持する）
  const defaultCdkDeployParameters = loadCdkDeployParametersDefault()
  const latestCdkDeployParameters = isNew
    ? null
    : await loadCdkDeployParametersFromSsm(cdkEnvKey).catch((e) => {
        console.log(chalk.yellow('error occurred in get ssm parameters.', e))
        return null
      })
  if (
    isNew ||
    (await willChangeCdkDeployParameters(
      defaultCdkDeployParameters,
      latestCdkDeployParameters || {}
    ))
  ) {
    const newParameters = await inputCdkDeployParameters(
      mergeCdkDeployParameters(defaultCdkDeployParameters, latestCdkDeployParameters || {})
    )
    console.log(chalk.gray('processing...'))
    await writeCdkDeployParametersToSsm(cdkEnvKey, newParameters, !!latestCdkDeployParameters)
    writeCdkDeployParametersToLocal(cdkEnvKey, newParameters)
  } else {
    console.log(chalk.gray('processing...'))
    writeCdkDeployParametersToLocal(
      cdkEnvKey,
      latestCdkDeployParameters || defaultCdkDeployParameters
    )
  }

  // stack app
  const cdkArgs = process.argv.slice(2) // コマンドライン引数(0: node, 1: script file, 2...: args)
  const stackNames = execSync(['cdk', 'list', ...cdkArgs].join(' '), {
    encoding: 'utf8',
    env: { ...process.env, [ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]: cdkEnvKey },
  })
    .split(/\r?\n/g)
    .filter((stackName) => stackName) // 空行の出力を除く

  if (!isNew) {
    // AWSのCloudFormation上にあるが、aws-cdkのソースコードとしてはないStack
    const willDeleteStacks = stackNamesPerCdkEnvKey[cdkEnvKey].filter(
      (stackName: string) => !stackNames.includes(stackName)
    )
    if (willDeleteStacks.length) {
      console.log(
        chalk.yellow(
          'There is unmanaged Stacks with aws-cdk. Remove them manually if necessary.',
          ...willDeleteStacks
        )
      )
      if (!(await new Confirm({ message: `continue?` }).run())) {
        return
      }
    }
  }

  // diff
  const resultDiff = await exec('cdk', ['diff', ...cdkArgs], {
    ...process.env,
    [ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]: cdkEnvKey,
  })
  console.log(resultDiff)

  // select Stacks to deploy
  let targetStacks: string[] = []
  while (targetStacks.length === 0) {
    targetStacks = await new MultiSelect({
      message: 'select Stacks to deploy',
      choices: stackNames,
    }).run()
  }

  if (!(await new Confirm({ message: 'Do you wish to deploy?' }).run())) {
    return
  }

  // deploy
  const resultDeploy = await exec('cdk', ['deploy', ...targetStacks, ...cdkArgs], {
    ...process.env,
    [ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]: cdkEnvKey,
  })
  console.log(resultDeploy)

  console.log(chalk.green('AWS-CDK Deploy Tool End.'))
}

run().catch((e: Error) => console.log(chalk.red(e.message || '', e.stack || '')))
