#!/usr/bin/env node
const fs = require('fs')
const mkdirp = require('mkdirp')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const Template = require('./template')
const fetchJson = require('./fetchJson')
const c = require('chalk')

const run = async function () {
  const { join, basename, dirname, relative } = require('path')
  const argv = yargs(hideBin(process.argv)).argv
  try {
    const { nuxtswagger } = await fetchJson('./package.json')
    for (const [key, value] of Object.entries(nuxtswagger)) {
      if (!/src|pluginsDir|pluginName|inject|typePath|refPrefix/.test(key)) continue
      if (!(key in argv)) argv[key] = value
    }
  } catch (e) {}
  const {
    _: [arg1],
    src = arg1,
    pluginsDir = 'plugins',
    pluginName = 'api',
    inject = pluginName,
    typePath = join(pluginsDir, pluginName, 'types.ts'),
    basePath = '/v1',
    refPrefix: $refPrefix
  } = argv

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
