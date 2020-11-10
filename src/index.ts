#!/usr/bin/env node
import Template from './template'
import fetchJson from './fetchJson'
const fs = require('fs')
const mkdirp = require('mkdirp')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const c = require('chalk')
enum options {
  src = 'src',
  pluginsDir = 'pluginsDir',
  pluginName = 'pluginName',
  inject = 'inject',
  typePath = 'typePath',
  basePath = 'basePath',
  refPrefix = 'refPrefix',
}

type Options = { [name in options]: string }
interface Argv extends Options{ _:[string] }
const run = async function () {
  const { join, basename, dirname, relative } = require('path')
  const { argv }: { argv: Argv } = yargs(hideBin(process.argv))
  try {
    const jsonPath = require('path').join(process.cwd(), 'package.json')
    const { nuxtswagger }: { nuxtswagger: Options } = require(jsonPath)
    Object.entries(nuxtswagger).forEach(([key, value]) => {
      if (!(key in options)) return
      if (!(key in argv)) argv[key as options] = value
    })
  } catch (e) { }
  const {
    _: [arg1],
    src = arg1,
    pluginsDir = 'plugins',
    pluginName = 'api',
    inject = pluginName,
    typePath = join(pluginsDir, pluginName, 'types.ts'),
    basePath = '/v1',
    refPrefix: $refPrefix
  }:Argv = argv

  mkdirp.sync(pluginsDir)
  mkdirp.sync(dirname(typePath))

  const { definitions, paths } = await fetchJson(src)

  const sameDir = join(pluginsDir, pluginName) === dirname(typePath)
  const pluginPath = sameDir ? join(pluginsDir, pluginName, 'index.ts') : join(pluginsDir, `${pluginName}.ts`)
  const relTypePath = (sameDir ? `./${basename(typePath)}` : relative(dirname(pluginPath), typePath)).replace(/\.ts$/, '')
  const template = new Template({ basePath, pluginName, inject, relTypePath, $refPrefix })

  console.log(c.green('  create'), pluginPath)
  fs.writeFileSync(pluginPath, template.plugin(paths, definitions))
  console.log(c.blue('  create'), typePath)
  fs.writeFileSync(typePath, template.definitions(definitions))
}
run()
