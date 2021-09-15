#!/usr/bin/env node
import V2 from './schema/v2/Template'
import V3 from './schema/v3/Template'
import fetchSpec from './fetchSpec'
import { join } from 'path'
import { LoDashStatic } from 'lodash'
const packageJson = require('../package.json')
const _:LoDashStatic = require('lodash')
const fs = require('fs')
const mkdirp = require('mkdirp')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const c = require('chalk')
enum OptionsEnum {
  src = 'src',
  pluginsDir = 'pluginsDir',
  pluginName = 'pluginName',
  inject = 'inject',
  typePath = 'typePath',
  basePath = 'basePath',
  skipHeader = 'skipHeader'
}

export type Options = Omit<{ [name in OptionsEnum]: string }, 'skipHeader'> & { skipHeader: boolean }
interface Argv extends Partial<Options> { _: [string?] }
const argvToOptions = ({ _: [$1], src = $1, ...rest }: Argv): Partial<Options> => ({ src, ...rest })
const defaultOptions = ({
  src = '',
  pluginsDir = 'plugins',
  pluginName = 'api',
  inject = pluginName,
  typePath = join(pluginsDir, pluginName, 'types.ts'),
  basePath = '/v1',
  skipHeader = false
}:Partial<Options> = {}):Options => ({ src, pluginsDir, pluginName, inject, typePath, basePath, skipHeader: !!skipHeader })

const optionsFromJson = ():Partial<Options> => {
  const ret: any = {}
  try {
    const jsonPath = require('path').join(process.cwd(), 'package.json')
    const { nuxtswagger }: { nuxtswagger: Partial<Options> } = require(jsonPath)
    Object.entries(nuxtswagger).forEach(([key, value]) => {
      if (key in OptionsEnum) ret[key] = value
    })
    return ret
  } catch (e) { return ret }
}

const pluginRelTypePath = ({ pluginsDir, typePath, pluginName }:Options) => {
  const { join, basename, dirname, relative } = require('path')
  const sameDir = join(pluginsDir, pluginName) === dirname(typePath)
  const pluginPath = sameDir ? join(pluginsDir, pluginName, 'index.ts') : join(pluginsDir, `${pluginName}.ts`)
  const relTypePath = (sameDir ? `./${basename(typePath)}` : relative(dirname(pluginPath), typePath)).replace(/\.ts$/, '')
  return { pluginPath, relTypePath }
}

const makeDirs = ({ pluginsDir, typePath }: Options) => {
  const { dirname } = require('path')
  mkdirp.sync(pluginsDir)
  mkdirp.sync(dirname(typePath))
}

const run = async function () {
  const { argv }:{argv:Argv} = yargs(hideBin(process.argv))
  const options = defaultOptions(_.defaults(argvToOptions(argv), optionsFromJson()))
  if (!options.src) throw Error('No JSON path provided')
  console.log(c.bold(c.green('Nux') + c.bgBlue.white('TS') + c.cyan('wagger')), c.gray(`(v${packageJson.version})`))
  const spec = await fetchSpec(options.src)
  makeDirs(options)

  const { pluginPath, relTypePath } = pluginRelTypePath(options)
  let template
  const templateOptions = { ...options, relTypePath }
  if (('swagger' in spec) && spec.swagger === '2.0') template = new V2(spec, templateOptions)
  if (('openapi' in spec) && parseInt(spec.openapi) === 3) template = new V3(spec, templateOptions)

  if (!template) throw Error('not support')
  console.log(c.green(' ✔ create  '), pluginPath)
  fs.writeFileSync(pluginPath, template.plugin())
  console.log(c.blue(' ✔ create  '), options.typePath)
  fs.writeFileSync(options.typePath, template.definitions())
}
run()
