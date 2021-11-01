#!/usr/bin/env node
import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import * as mkdirp from 'mkdirp'
import c from 'chalk'
import fetchSpec from './fetchSpec'
import V3 from './schema/v3/Template'
import V2 from './schema/v2/Template'
import { notNullish } from './utils'
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { version } = require('../package.json')

export interface Options {
  src: string
  pluginsDir: string
  pluginName: string
  inject: string
  typePath: string
  basePath: string
  skipHeader: boolean
  form?: 'underscore'
}

interface Argv extends Partial<Options> { _: [string?] }
const argvToOptions = ({ _: [$1], src = $1, ...rest }: Argv): Partial<Options> => ({ src, ...rest })
const defaultOptions = ({
  src = '',
  pluginsDir = 'plugins',
  pluginName = 'api',
  inject = pluginName,
  typePath = path.join(pluginsDir, pluginName, 'types.ts'),
  basePath = '/v1',
  skipHeader = false,
  form,
}: Partial<Options> = {}): Options => ({ src, pluginsDir, pluginName, inject, typePath, basePath, skipHeader, form })

const optionsFromJson = (): Partial<Options>[] => {
  const ret: any = {}
  try {
    const jsonPath = path.join(process.cwd(), 'package.json')
    const { nuxtswagger }: { nuxtswagger: Partial<Options> | Partial<Options>[] } = require(jsonPath)
    return [nuxtswagger].flat().filter(x => x)
  } catch (e) { return ret }
}

const pluginRelTypePath = ({ pluginsDir, typePath, pluginName }: Options) => {
  const { join, basename, dirname, relative } = path
  const sameDir = join(pluginsDir, pluginName) === dirname(typePath)
  const pluginPath = sameDir ? join(pluginsDir, pluginName, 'index.ts') : join(pluginsDir, `${pluginName}.ts`)
  const relTypePath = (sameDir ? `./${basename(typePath)}` : relative(dirname(pluginPath), typePath)).replace(/\.ts$/, '')
  return { pluginPath, relTypePath }
}

const makeDirs = ({ pluginsDir, typePath }: Options) => {
  mkdirp.sync(pluginsDir)
  mkdirp.sync(path.dirname(typePath))
}

const generate = async (options: Options) => {
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
  const jsonOptions = optionsFromJson()
  if (!jsonOptions.length) return await generate(defaultOptions(argvToOptions(argv)))
  for (const jsonOption of jsonOptions) {
    await generate(defaultOptions(_.defaults(argvToOptions(argv), jsonOption)))
  }
}
run()
