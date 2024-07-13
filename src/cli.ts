#!/usr/bin/env node
import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import * as mkdirp from 'mkdirp'
import c from 'chalk'
import jiti from 'jiti'
import { NuxtConfig } from '@nuxt/schema'
import { notNullish } from 'tswagger/dist/utils'
import { genTypeFile } from 'tswagger'
import fetchSpec from 'tswagger/dist/fetchSpec'
import { genAxiosCode } from './axios'
import { NuxTSwaggerCliOptions as CliOptions, NuxTSwaggerOptions as Options } from './index'
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { version } = require('../package.json')
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'
interface Argv extends Partial<CliOptions> { _: [string?] }
const argvToOptions = ({ _: [$1], src = $1, ...rest }: Argv): Partial<CliOptions> => ({ src, ...rest })
const defaultOptions = ({
  src = '',
  pluginsDir = 'lib',
  pluginName = 'api',
  exportName = pluginName,
  typePath = path.join(pluginsDir, pluginName, 'types.ts'),
  basePath = '/v1',
  axiosConfig,
}: Partial<Options> = {}): Options => ({ src, pluginsDir, pluginName, exportName, typePath, basePath, axiosConfig })

const loadNuxtConfig = () => {
  try {
    (globalThis as any).defineNuxtConfig = (c: any) => c
    const nuxtConfig: NuxtConfig = jiti(process.cwd(), { interopDefault: true, esmResolve: true })('./nuxt.config')
    delete (globalThis as any).defineNuxtConfig
    return Promise.resolve(nuxtConfig)
  } catch (e) {
    return Promise.resolve(undefined)
  }
}
const optionsFromNuxtConfig = () => loadNuxtConfig().then(config => {
  type NuxTSwaggerConfig = Partial<Options> | Partial<Options>[]
  const privateConfig = config?.nuxtswagger
  const publicConfig: NuxTSwaggerConfig | undefined = (config?.runtimeConfig?.public as any)?.nuxtswagger
  const keyBy = (options?: NuxTSwaggerConfig) => _.keyBy([options].filter(notNullish).flat(), x => x.pluginName)
  const publicConfigs = keyBy(publicConfig)
  const privateConfigs = keyBy(privateConfig)
  const names = _.uniq([Object.keys(publicConfigs), Object.keys(privateConfigs)].flat())
  return names.map(name => _.merge({}, publicConfigs[name], privateConfigs[name])) as Partial<Options>[]
})

const optionFromJson = (): Partial<CliOptions> => {
  const ret: any = {}
  try {
    const jsonPath = path.join(process.cwd(), 'package.json')
    const { nuxtswagger }: { nuxtswagger: Partial<CliOptions> } = require(jsonPath)
    return nuxtswagger
  } catch (e) { return ret }
}

const pluginRelTypePath = ({ pluginsDir, typePath, pluginName }: CliOptions) => {
  const { join, basename, dirname, relative } = path
  const sameDir = join(pluginsDir, pluginName) === dirname(typePath)
  const pluginPath = sameDir ? join(pluginsDir, pluginName, 'index.ts') : join(pluginsDir, `${pluginName}.ts`)
  const relTypePath = (sameDir ? `./${basename(typePath)}` : relative(dirname(pluginPath), typePath)).replace(/\.ts$/, '')
  return { pluginPath, relTypePath }
}

const makeDirs = ({ pluginsDir, typePath }: CliOptions) => {
  mkdirp.sync(pluginsDir)
  mkdirp.sync(path.dirname(typePath))
}

const generate = async (options: Options) => {
  if (!options.src) throw new Error('No JSON path provided')
  const spec = await fetchSpec(options.src)
  makeDirs(options)

  const { pluginPath, relTypePath } = pluginRelTypePath(options)
  const schemas = ('openapi' in spec ? spec.components?.schemas : 'swagger' in spec ? spec.definitions : {}) || {}

  fs.writeFileSync(options.typePath, genTypeFile(schemas))
  console.log(c.blue(' ✔ create  '), options.typePath)
  fs.writeFileSync(pluginPath, genAxiosCode(spec.paths, relTypePath, schemas, options))
  console.log(c.green(' ✔ create  '), pluginPath)
}

const run = async function () {
  console.log(c.bold(c.green('Nux') + c.bgBlue.white('TS') + c.cyan('wagger')), c.gray(`(v${version})`))
  const { argv }: { argv: Argv } = yargs(hideBin(process.argv))
  const cliOption = argvToOptions(argv)
  const jsonOption = optionFromJson()
  const configOptions = await optionsFromNuxtConfig()
  let partialOptions = [configOptions, cliOption, jsonOption].flat().filter(notNullish)
  if (cliOption.pluginName || cliOption.src) {
    const { pluginName } = defaultOptions()
    partialOptions = partialOptions.filter(x => (x.pluginName || pluginName) === (cliOption.pluginName || pluginName))
  }
  let options = _.uniqBy(partialOptions.map(option => defaultOptions(_.defaults({}, cliOption, option, jsonOption)))
    , x => x.pluginName)
  if (options.filter(x => x.src).length) options = options.filter(x => x.src)
  for (const option of options) await generate(option)
}
run()
