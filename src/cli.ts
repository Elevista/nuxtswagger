#!/usr/bin/env node
import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import * as mkdirp from 'mkdirp'
import c from 'chalk'
import { NuxtConfig } from '@nuxt/types'
import { fetchSpec, notNullish } from 'tswagger'
import { V2, V3 } from './TemplateNuxt'
import { NuxTSwaggerCliOptions as CliOptions, NuxTSwaggerOptions as Options } from './index'
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { version } = require('../package.json')
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'
interface Argv extends Partial<CliOptions> { _: [string?] }
const argvToOptions = ({ _: [$1], src = $1, ...rest }: Argv): Partial<CliOptions> => ({ src, ...rest })
const defaultOptions = ({
  src = '',
  pluginsDir = 'plugins',
  pluginName = 'api',
  inject = pluginName,
  typePath = path.join(pluginsDir, pluginName, 'types.ts'),
  basePath = '/v1',
  skipHeader = false,
  form,
  axiosConfig,
}: Partial<Options> = {}): Options => ({ src, pluginsDir, pluginName, inject, typePath, basePath, skipHeader, form, axiosConfig })

const loadNuxtConfig = async () => {
  try {
    return await require('nuxt').loadNuxtConfig() as NuxtConfig
  } catch (e) {
    return undefined
  }
}
const optionsFromNuxtConfig = () => loadNuxtConfig().then(config => {
  let { publicRuntimeConfig, privateRuntimeConfig } = config || {}
  const keyBy = (options?: Partial<Options> | Partial<Options>[]) => _.keyBy([options].filter(notNullish).flat(), x => x.pluginName)
  if (typeof publicRuntimeConfig === 'function') publicRuntimeConfig = publicRuntimeConfig(process.env)
  if (typeof privateRuntimeConfig === 'function') privateRuntimeConfig = privateRuntimeConfig(process.env)
  const publicConfigs = keyBy(publicRuntimeConfig?.nuxtswagger)
  const privateConfigs = keyBy(privateRuntimeConfig?.nuxtswagger)
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

const generate = async (options: CliOptions) => {
  if (!options.src) throw new Error('No JSON path provided')
  const spec = await fetchSpec(options.src)
  makeDirs(options)

  const { pluginPath, relTypePath } = pluginRelTypePath(options)
  let template
  const templateOptions = { ...options, relTypePath }
  if (('swagger' in spec) && spec.swagger === '2.0') template = new V2(spec, templateOptions)
  if (('openapi' in spec) && parseInt(spec.openapi) === 3) template = new V3(spec, templateOptions)

  if (!template) throw new Error('not support')
  console.log(c.green(' ✔ create  '), pluginPath)
  fs.writeFileSync(pluginPath, template.plugin())
  console.log(c.blue(' ✔ create  '), options.typePath)
  fs.writeFileSync(options.typePath, template.definitions())
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
  const options = _.uniqBy(partialOptions.map(option => defaultOptions(_.defaults({}, cliOption, option, jsonOption)))
    , x => x.pluginName)
  for (const option of options) await generate(option)
}
run()
