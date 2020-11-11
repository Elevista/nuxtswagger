import { Definitions, Method, MethodTypes, Paths, Types, Ref, TypeArray, TypeObject, ParameterTypes } from './spec/OpenAPI2'
interface Parameter {type: string, required: boolean, name: string}

const _ = require('lodash')
const typeMatch = 'type integer = number'
export default class Template {
  private readonly relTypePath:string
  private readonly $refPrefix:string
  private readonly basePath:string
  private readonly inject:string
  private readonly className:string
  constructor ({ pluginName, basePath, inject, relTypePath, $refPrefix = '#/definitions/' }:{pluginName:string, basePath:string, inject:string, relTypePath:string, $refPrefix:string}) {
    this.relTypePath = relTypePath
    this.$refPrefix = $refPrefix
    this.basePath = basePath
    this.inject = inject.replace(/^[^a-zA-Z]+/, '').replace(/^[A-Z]/, x => x.toLowerCase())
    this.className = pluginName.replace(/^[^a-zA-Z]+/, '').replace(/^[a-z]/, x => x.toUpperCase())
  }

  strip (ref:Ref) { return ref.$ref.replace(this.$refPrefix, '') || '' }

  importTypes (definitions:Definitions) {
    return `import { ${Object.keys(definitions).join(', ')} } from '${this.relTypePath}'`
  }

  comment (comment?:string|number|boolean) {
    if (!comment) { return '' }
    const lines = comment.toString().trim().split('\n')
    if (lines.length === 1) { return ` // ${lines[0]}` }
    return ['\n/**', ...lines.map(x => ` * ${x}`), ' */'].join('\n')
  }

  typeDeep (typeObj:Types|ParameterTypes):string {
    if ('schema' in typeObj) return this.typeDeep(typeObj.schema)
    if ('$ref' in typeObj) return this.strip(typeObj)
    if ('enum' in typeObj) {
      return `(${typeObj.enum.map(x => JSON.stringify(x).replace(/"/g, '\'')).join(' | ')})`
    }
    if (!('type' in typeObj)) return 'any'
    if (typeObj.type === 'array') return `Array<${this.typeDeep(typeObj.items)}>`
    if (typeObj.type === 'object') {
      if (!typeObj.properties) return 'any'
      const types:string = Object.entries(typeObj.properties)
        .map(([name, value]) => `${name}: ${this.typeDeep(value)}`).join(', ')
      return `{ ${types} }`
    }
    return typeObj.type
  }

  definitions (definitions:Definitions) {
    const array = (name:string, definition:TypeArray) => {
      const type = this.typeDeep(definition)
      return `export type ${name} = ${type}`
    }
    const object = (name:string, { properties, required }:TypeObject) => {
      const content = Object.entries(properties || {}).map(([property, definition]) => {
        const type = this.typeDeep(definition)
        const optional = required?.includes(property) ? '' : '?'
        const comment = ('example' in definition) ? this.comment(definition.example) : ''
        return `${property}${optional}: ${type}${comment}`
      }).join('\n').replace(/^(.)/mg, '  $1')
      return `export interface ${name} {\n${content}\n}`
    }
    return [
      '/* eslint-disable */',
      typeMatch,
      ...Object.entries(definitions).map(([name, definition]) => {
        if ('type' in definition) {
          if (definition.type === 'array') return array(name, definition)
          if (definition.type === 'object') return object(name, definition)
        }
        return undefined
      }).filter(x => x), ''].join('\n')
  }

  params (args: Array<Parameter>) {
    const [requires, optionals]:[string[], string[]] = [[], []]
    args.forEach(({ name, type, required }) => {
      const optional = required ? '' : '?'
      const res = `${name}${optional}: ${type}`
      required ? requires.push(res) : optionals.push(res)
    })
    return `(${[...requires, ...optionals].join(', ')})`
  }

  axiosCall (path: string, method: MethodTypes, { parameters, responses, summary }: Method) {
    const pathParams:{[key:string]:Parameter|undefined} = _(path.match(/{\w+}/g))
      .map((x:string) => x.replace(/[{}]/g, '')).zipObject().value()
    let body:Parameter|undefined
    const [headers, query]: [{ [x: string]: Parameter }, { [x: string]: Parameter }] = [{}, {}]
    parameters?.forEach((parameter) => {
      const type = this.typeDeep(parameter)
      const { in: inside, required = false, name } = parameter
      if (inside === 'header') { headers[name] = { name, type, required } }
      if (inside === 'query') { query[name] = { name, type, required } }
      if (inside === 'body') { body = { name: 'data', type, required: true } }
      if (inside === 'path') { pathParams[name] = { name, type, required: true } }
    })
    const arrOf = {
      queries: Object.values(query),
      headers: Object.values(headers)
    }
    const params = Object.values(pathParams).filter((x): x is Parameter => !!x)
    params.push(...arrOf.queries)
    if (body) { params.push(body) }
    params.push(...arrOf.headers)

    const axiosParams = [`\`${path.replace(/{/g, '${')}\``]
    if (body) { axiosParams[1] = body.name }
    if (arrOf.headers.length || arrOf.queries.length) {
      const noBody = /get|delete/.test(method)
      const join = (arr:Parameter[]) => arr.map(x => x.name).join(', ')
      const headers = arrOf.headers.length ? `headers: { ${join(arrOf.headers)} }` : ''
      const params = arrOf.queries.length ? `params: { ${join(arrOf.queries)} }` : ''
      axiosParams[noBody ? 1 : 2] = `{ ${[headers, params].filter(x => x).join(', ')} }`
    }
    const schema:Types|{} = _.get(responses, '200.schema') || {}
    let type = 'any'
    if ('type' in schema) type = schema.type
    if ('$ref' in schema) type = this.strip(schema)
    const paramsString = [...axiosParams].map(x => x || 'undefined').join(', ')
    return `${this.params(params)}: Promise<${type}> => this.$axios.$${method}(${paramsString})/*${summary}*/`
  }

  plugin (paths:Paths, definitions:Definitions) {
    const propTree:{[paths:string]:string} = {}
    const base = this.basePath
    Object.entries(paths).forEach(([path, methods]) => {
      const keyPath = (path.startsWith(base + '/') ? path.replace(base, '') : path)
        .replace(/[^/{}\w]/g, '_')
        .replace(/([a-z\d])_([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase()) // foo_bar => fooBar
        .replace(/{(\w+)}/g, '_$1') // {foo} => _foo
        .split(/\//).slice(1)
      if (/^v\d+$/.test(keyPath[0])) keyPath.push(keyPath.shift() || '')
      Object.entries(methods).forEach(([key, method]) => {
        if (!(key in MethodTypes)) return
        const methodType = key as MethodTypes
        _.set(propTree, [...keyPath, methodType], this.axiosCall(path, methodType, method))
      })
    })
    const properties = Object.entries(propTree).map(([property, child]) => {
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
