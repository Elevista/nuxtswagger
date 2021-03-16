#!/usr/bin/env node
import V2 from './schema/v2/Template'
import V3 from './schema/v3/Template'
import fetchSpec from './fetchSpec'
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

export type Options = { [name in keyof Omit<typeof OptionsEnum, 'skipHeader'>]: string } & { skipHeader: boolean }
interface Argv extends Partial<Options> { _: [string?] }

const fillArgvFromJson = (argv:Argv) => {
  try {
    const jsonPath = require('path').join(process.cwd(), 'package.json')
    const { nuxtswagger }: { nuxtswagger: Partial<Options> } = require(jsonPath)
    Object.entries(nuxtswagger).forEach(([key, value]) => {
      if (!(key in OptionsEnum)) return
      if (!(key in argv)) (argv as any)[key] = value
    })
  } catch (e) { }
}

const optionWithDefaults = (argv:Argv):Options => {
  const { join } = require('path')
  const {
    src: srcOpt,
    _: [src = srcOpt],
    pluginsDir = 'plugins',
    pluginName = 'api',
    inject = pluginName,
    typePath = join(pluginsDir, pluginName, 'types.ts'),
    basePath = '/v1',
    skipHeader
  } = argv
  if (!src) throw Error('No JSON path provided')
  return { src, pluginsDir, pluginName, inject, typePath, basePath, skipHeader: !!skipHeader }
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
  fillArgvFromJson(argv)
  const options = optionWithDefaults(argv)

  const spec = await fetchSpec(options.src)
  makeDirs(options)

  const { pluginPath, relTypePath } = pluginRelTypePath(options)
  let template
  const templateOptions = { ...options, relTypePath }
  if (('swagger' in spec) && spec.swagger === '2.0') template = new V2(spec, templateOptions)
  if (('openapi' in spec) && parseInt(spec.openapi) === 3) template = new V3(spec, templateOptions)

  if (!template) throw Error('not support')
  console.log(c.green('  create'), pluginPath)
  fs.writeFileSync(pluginPath, template.plugin())
  console.log(c.blue('  create'), options.typePath)
  fs.writeFileSync(options.typePath, template.definitions())
}
run()
