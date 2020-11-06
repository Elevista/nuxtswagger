const _ = require('lodash')
const typeMatch = `
type integer = number
type float = number
`.trim()
module.exports = class Template {
  constructor ({ pluginName, basePath, inject, relTypePath, $refPrefix = '#/definitions/' }) {
    this.relTypePath = relTypePath
    this.$refPrefix = $refPrefix
    this.basePath = basePath
    this.inject = inject.replace(/^[^a-zA-Z]+/, '').replace(/^[A-Z]/, x => x.toLowerCase())
    this.className = pluginName.replace(/^[^a-zA-Z]+/, '').replace(/^[a-z]/, x => x.toUpperCase())
  }

  strip ($ref) { return $ref && $ref.replace(this.$refPrefix, '') }

  importTypes (definitions) {
    return `import { ${Object.keys(definitions).join(', ')} } from '${this.relTypePath}'`
  }

  comment (comment) {
    if (!comment) { return '' }
    const lines = comment.toString().trim().split('\n')
    if (lines.length === 1) { return ` // ${lines[0]}` }
    return ['\n/**', ...lines.map(x => ` * ${x}`), ' */'].join('\n')
  }

  typeDeep ({ $ref, type, enum: enumerator, properties = {}, items = {} }) {
    if ($ref) return this.strip($ref)
    if (enumerator) return `(${enumerator.map(x => JSON.stringify(x).replace(/"/g, '\'')).join(' | ')})`
    if (type === 'array') return `Array<${this.typeDeep(items)}>`
    if (type === 'object') {
      const types = _.map(properties, (value, name) => `${name}: ${this.typeDeep(value)}`).join(', ')
      return `{ ${types} }`
    }
    return type || 'any'
  }

  definitions (definitions) {
    const array = (name, definition) => {
      const type = this.typeDeep(definition)
      return `export type ${name} = ${type}`
    }
    const object = (name, { properties, required }) => {
      const content = _(properties).map(({ example, ...definition }, property) => {
        const type = this.typeDeep(definition)
        const optional = required && required.includes(property) ? '' : '?'
        const comment = this.comment(example)
        return `${property}${optional}: ${type}${comment}`
      }).join('\n').replace(/^(.)/mg, '  $1')
      return `export interface ${name} {\n${content}\n}`
    }
    return [
      '/* eslint-disable */',
      typeMatch,
      ..._.map(definitions, (definition, name) => {
        if (definition.type === 'array') return array(name, definition)
        if (definition.type === 'object') return object(name, definition)
      }).filter(x => x), ''].join('\n')
  }

  args (args) {
    const [requires, optionals] = [[], []]
    args.forEach(({ name, type, required = true, items = {} }) => {
      const optional = required ? '' : '?'
      if (items.type) type += `<${items.type}>`
      const res = `${name}${optional}: ${type}`
      required ? requires.push(res) : optionals.push(res)
    })
    return `(${[...requires, ...optionals].join(', ')})`
  }

  axiosCall (path, method, { parameters, responses, summary }) {
    const pathParams = _(path.match(/{\w+}/g))
      .map(x => x.replace(/[{}]/g, '')).zipObject().value()
    let body
    const [headers, query] = [{}, {}]
    _.forEach(parameters, ({ name, schema: { $ref } = {}, type, in: inside, required, items = {} }) => {
      type = this.typeDeep({ type, $ref, items })
      if (inside === 'header') { headers[name] = { type, items, required } }
      if (inside === 'query') { query[name] = { type, items, required } }
      if (inside === 'body') { body = { type, items, required } }
      if (inside === 'path') { pathParams[name] = type }
    })
    const args = _.map(pathParams, (type, name) => ({ type, name }))
    const queryEntries = Object.entries(query)
    queryEntries.forEach(([name, { type, required }]) => args.push({ type, name, required }))

    if (body) { args.push({ ...body, name: 'data' }) }

    const headerEntries = Object.entries(headers)
    headerEntries.forEach(([name, { type, required }]) => args.push({ type, name, required }))

    const axiosArgs = [`\`${path.replace(/{/g, '${')}\``]
    if (body) { axiosArgs[1] = 'data' }
    if (headerEntries.length || queryEntries.length) {
      const noBody = /get|delete/.test(method)
      const headers = headerEntries.length ? `headers: { ${headerEntries.map(x => x[0]).join(', ')} }` : ''
      const query = queryEntries.length ? `params: { ${queryEntries.map(x => x[0]).join(', ')} }` : ''
      axiosArgs[noBody ? 1 : 2] = `{ ${[headers, query].filter(x => x).join(', ')} }`
    }
    const { $ref, type = this.strip($ref) } = _.get(responses, '200.schema') || {}
    const responseType = type || 'any'
    const argsString = [...axiosArgs].map(x => x || 'undefined').join(', ')
    return `${this.args(args)}: Promise<${responseType}> => this.$axios.$${method}(${argsString})/*${summary}*/`
  }

  plugin (paths, definitions) {
    const propTree = {}
    const base = this.basePath
    _.forEach(paths, (methods, path) => {
      const keyPath = (path.startsWith(base + '/') ? path.replace(base, '') : path)
        .replace(/[^/{}\w]/g, '_')
        .replace(/([a-z\d])_([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase()) // foo_bar => fooBar
        .replace(/{(\w+)}/g, '_$1') // {foo} => _foo
        .split(/\//).slice(1)
      if (/^v\d+$/.test(keyPath[0])) keyPath.push(keyPath.shift())
      _.forEach(methods, ({ parameters = [], responses, summary }, method) => {
        _.set(propTree, [...keyPath, method], this.axiosCall(path, method, { parameters, responses, summary }))
      })
    })

    const properties = _.map(propTree, (child, property) => {
      const code = JSON.stringify(child, null, '  ')
        .replace(/"/g, '')
        .replace(/^([ ]+)(.+?)\/\*(.+?)\*\//gm, (_, indent, code, comment) => {
          comment = this.comment(comment.replace(/\\n/g, '\n')).trim()
          return `${comment}\n${code}`.replace(/^/gm, indent)
        })
      return `${property} = ${code}\n`
    }).join('\n').trim().replace(/^(.)/mg, '  $1')
    return `
/* eslint-disable */
import { Plugin } from '@nuxt/types'
import { NuxtAxiosInstance } from '@nuxtjs/axios'
${this.importTypes(definitions)}
${typeMatch}

class ${this.className} {
  private $axios: NuxtAxiosInstance
  constructor ($axios: NuxtAxiosInstance) {
    this.$axios = $axios
  }

${properties}
}
declare module '@nuxt/types' {
  interface NuxtAppOptions { $${this.inject}: ${this.className} }
}
declare module 'vue/types/vue' {
  interface Vue { $${this.inject}: ${this.className} }
}
declare module 'vuex/types/index' {
  interface Store<S> { $${this.inject}: ${this.className} }
}

const plugin: Plugin = ({ $axios }, inject) => {
  inject('${this.inject}', new ${this.className}($axios))
}
export default plugin
`.trimStart()
  }
}
