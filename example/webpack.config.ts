import webpack from 'webpack'
import { ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY, getStackParameters } from '../lib'

const configFunction: () => Promise<webpack.Configuration> = async () => {
  const cdkEnvKey = process.env[ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY]
  if (!cdkEnvKey) {
    throw Error(`Environment Variable not found: ${ENVIRONMENT_VARIABLE_NAME_CDK_ENV_KEY}`)
  }

  // load stack parameters from ssm by cdkEnvKey
  const params = await getStackParameters(cdkEnvKey)

  const watch = !!process.env.WATCH

  return {
    entry: {
      index: 'index.ts'
    },
    output: {
      filename: '[id].[hash].js',
      chunkFilename: '[id].[hash].js',
      path: 'dist',
      publicPath: '/'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    module: {
      rules: [
        {
          test: /\.(ts|js)x?$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                babelrc: false,
                sourceType: 'unambiguous',
                presets: [
                  ...(watch
                    ? []
                    : [
                        [
                          '@babel/preset-env',
                          {
                            targets: ['>3%'],
                            modules: false,
                            useBuiltIns: 'usage',
                            corejs: { version: 2, proposals: true }
                          }
                        ]
                      ]),
                  '@babel/preset-typescript',
                  '@babel/preset-react'
                ],
                plugins: [
                  ['@babel/plugin-proposal-decorators', { legacy: true }],
                  ['@babel/plugin-proposal-class-properties', { loose: true }],
                  '@babel/plugin-syntax-dynamic-import',
                  ...(watch ? ['react-hot-loader/babel'] : [])
                ]
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        ...Object.keys(params).reduce(
          (payload, key) => ({ ...payload, [key]: JSON.stringify(params[key]) }),
          {}
        )
      })
    ]
  }
}

export default configFunction
