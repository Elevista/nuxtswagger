import { Options } from './index'
import { camelCase } from './utils'
import * as v2 from './schema/v2/Spec'
import * as v3 from './schema/v3/Spec'
type ParameterPositions = v2.ParameterPositions| v3.ParameterPositions
interface Parameter { type: string, required: boolean, name: string, valName:string, pos: ParameterPositions | '$body' | '$config' }
type Response = v2.Response | v3.Response
type TypeDefs = v2.Types | v2.ParameterTypes | v3.Types | v3.ParameterTypes
type Spec = v2.Spec | v3.Spec
type Method = v2.Method | v3.Method
type Schemas = v2.Definitions | v3.Schemas
type Types = v2.Types | v3.Types
type TypeArray = v2.TypeArray | v3.TypeArray
type TypeObject = v2.TypeObject | v3.TypeObject

enum MethodTypes {get = 'get', post = 'post', put = 'put', patch = 'patch', delete = 'delete', head = 'head', options = 'options'}
export type TemplateOptions = Options & { relTypePath: string }

const _ = require('lodash')
const typeMatch = ['integer', 'long'].map(x => `type ${x} = number`).join('\n')
const entriesCompare = <T>([a]:[string, T], [b]:[string, T]) => a.localeCompare(b)
const exists = <TValue>(value: TValue | null | undefined): value is TValue => !!value
const genericVar = (i: number) => {
  const arr = ['T', 'U', 'V']
  return i < arr.length ? arr[i] : `T${i + 1 - arr.length}`
}
const noInspect = '/* eslint-disable */\n// noinspection ES6UnusedImports,JSUnusedLocalSymbols\n'
const escapeRegExp = (string:string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export abstract class TemplateCommon {
  protected abstract spec:Spec
  protected readonly relTypePath:string
  protected readonly basePath:string
  protected readonly inject:string
  protected readonly className:string
  protected readonly skipHeader:boolean
  protected constructor (spec:Spec, { pluginName, basePath, inject, skipHeader, relTypePath }:TemplateOptions) {
    this.relTypePath = relTypePath
    this.basePath = basePath
    this.skipHeader = skipHeader
    this.inject = inject.replace(/^[^a-zA-Z]+/, '').replace(/^[A-Z]/, x => x.toLowerCase())
    this.className = pluginName.replace(/^[^a-zA-Z]+/, '').replace(/^[a-z]/, x => x.toUpperCase())
    this.fixRefDeep(spec)
  }

  abstract get schemas():Schemas
  abstract getResponseType(response:Response):string

  fixTypeName = (name: string) => name
    .replace(/^#\/(components\/schemas|definitions)\//, '')
    .replace(/«/g, '<').replace(/»/g, '>')
    .replace(/List<(.+?)>/g, 'Array<$1>')
    .replace(/[^0-9a-zA-Z_$<>, ]/g, '')
    .replace(/.+/, camelCase)
    .replace(/[ ]+$/g, '')

  comment (comment?:string|number|boolean|object) {
    if (comment === undefined) { return '' }
    if (comment === Object(comment)) comment = JSON.stringify(comment)
    const lines = comment.toString().trim().split('\n')
    if (lines.length === 1) { return ` // ${lines[0]}` }
    return ['\n/**', ...lines.map(x => ` * ${x}`), ' */'].join('\n')
  }

  typeDeep (typeObj:TypeDefs):string {
    if ('schema' in typeObj) return this.typeDeep(typeObj.schema)
    if ('$ref' in typeObj) return typeObj.$ref
    if ('enum' in typeObj) {
      return `(${typeObj.enum.map(x => JSON.stringify(x).replace(/"/g, '\'')).join(' | ')})`
    }
    if (!('type' in typeObj)) return 'any'
    if (typeObj.type === 'array') return `Array<${this.typeDeep(typeObj.items)}>`
    if (typeObj.type === 'object') {
      const { properties, additionalProperties: additional } = typeObj
      return [
        properties && Object.entries(properties).map(([name, value]) => `${name}: ${this.typeDeep(value)}`).join(', '),
        additional && `[key in any]?: ${'type' in additional ? this.typeDeep(additional) : 'any'}`
      ].filter(x => x).map(x => `{ ${x} }`).join(' & ') || 'any'
    }
    return typeObj.type
  }

  params (args: Parameter[]) {
    const arr = () => {
      const { path = [], body = [], $config, ...others }: { [_: string]: Parameter[] | undefined } = _.groupBy(args, 'pos')
      const map = (args:Parameter[]) => {
        const [names, requires, optionals]:[string[], string[], string[]] = [[], [], []]
        args.forEach(({ valName: name, type, required }) => {
          const optional = required ? '' : '?'
          const res = `${name}${optional}: ${type}`
          required ? requires.push(res) : optionals.push(res)
          names.push(name)
        })
        return [names, requires, optionals]
      }
      if ((args.length - (path.length + body.length)) < 5) return map(args).slice(-2).flat()
      const [requires, optionals] = map([...path, ...body]).slice(-2)
      const [names, ...rest] = map(Object.values(others).filter(exists).flat())
      let obj = `{ ${names.join(', ')} }: { ${rest.flat().join(', ')} }`
      if ($config) obj += ', ' + map($config).slice(1).flat().join(', ')
      return [requires, obj, optionals].flat()
    }
    return `(${arr().join(', ')})`
  }

  fixKeys<T extends object> (o:T):T {
    const ret:any = {}
    Object.entries(o).forEach(([key, value]) => { ret[this.fixTypeName(key)] = value })
    return ret
  }

  fixRefDeep (spec:Spec) {
    const deep = (o:any) => {
      if (!(o instanceof Object)) return
      if ('$ref' in o) o.$ref = this.fixTypeName(o.$ref)
      else if (o instanceof Array) o.forEach(deep)
      else Object.values(o).forEach(deep)
    }
    deep(spec)
  }

  importTypes () {
    const withoutGeneric = Object.keys(this.schemas).map(x => x.replace(/<.+>/, ''))
    return `import { ${_.uniq(withoutGeneric).sort().join(', ')} } from '${this.relTypePath}'`
  }

  definitions () {
    const array = (name:string, definition:TypeArray) => {
      const type = this.typeDeep(definition)
      return `export type ${name} = ${type}`
    }
    const object = (rawName:string, { properties, required }:TypeObject) => {
      const [name = rawName, genericString = ''] = rawName.match(/.+?<(.+)>/) || []
      const generics = genericString
        .replace(/<.+>/, x => x.replace(/,/g, '\x00'))
        .split(',')
        .map(x => x.replace(/\x00/g, ',')) // eslint-disable-line no-control-regex
        .filter(x => x)
      const entries:Array<[string, Types]> = properties ? Object.entries(properties) : []
      const content = entries.map(([property, definition]) => {
        const type = this.typeDeep(definition)
        const optional = required?.includes(property) ? '' : '?'
        const title = ('title' in definition) ? this.comment(definition.title) : ''
        const example = ('example' in definition) ? this.comment(definition.example) : ''
        let comment = title
        if (example.startsWith('\n')) comment += example
        else if (title && example) comment += example.replace('// ', '(') + ')'
        return `${property}${optional}: ${type}${comment}`
      }).join('\n').replace(/^./mg, '  $&')
      let ret = `export interface ${name} {\n${content}\n}`
      generics
        .map((x, i) => [x, genericVar(i)])
        .sort(([a], [b]) => b.length - a.length)
        .forEach(([x, t]) => { ret = ret.replace(new RegExp(escapeRegExp(x), 'g'), t) })
      return ret
    }
    const definitions = Object.entries(this.schemas).sort(entriesCompare)
      .map(([name, definition]) => {
        if ('type' in definition) {
          if (definition.type === 'array') return array(name, definition)
          if (definition.type === 'object') return object(name, definition)
        }
        return undefined
      }).filter(x => x)
    return [noInspect, typeMatch, ..._.uniq(definitions), ''].join('\n')
  }

  plugin () {
    const { paths } = this.spec
    const propTree:{[paths:string]:string} = {}
    const base = this.basePath
    Object.entries(paths).sort(entriesCompare).forEach(([path, methods]) => {
      const keyPath = (path.startsWith(base + '/') ? path.replace(base, '') : path)
        .replace(/[^/{}\w]/g, '_')
        .replace(/([a-z\d])_([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase()) // foo_bar => fooBar
        .replace(/{(\w+)}/g, '_$1') // {foo} => _foo
        .replace(/\/$/, '/$root')
        .split(/\//).slice(1)
      if (/^v\d+$/.test(keyPath[0])) keyPath.push(keyPath.shift() || '')
      Object.entries(methods).sort(entriesCompare).forEach(([key, method]) => {
        if (!(key in MethodTypes)) return
        const methodType = key as MethodTypes
        _.set(propTree, [...keyPath, methodType], this.axiosCall(path, methodType, method as Method))
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
    }).join('\n').trim().replace(/^./mg, '  $&')
    return this.pluginTemplate({ properties })
  }

  axiosCall (path: string, method: MethodTypes, methodSpec: Method) {
    const { parameters, responses, summary } = methodSpec
    const pathParams:{[key:string]:Parameter|undefined} = _(path.match(/{.+?}/g))
      .map((x:string) => x.replace(/[{}]/g, '')).zipObject().value()
    let body: Parameter | undefined
    const [headers, query]: [{ [x: string]: Parameter }, { [x: string]: Parameter }] = [{}, {}]
    parameters?.forEach((parameter) => {
      const type = this.typeDeep(parameter)
      const { in: pos, required = false, name } = parameter
      const valName = camelCase(name)
      if (!this.skipHeader && pos === 'header') { headers[name] = { name, valName, pos, type, required } }
      if (pos === 'query') { query[name] = { name, valName, pos, type, required } }
      if (pos === 'body') { body = { name: '$body', valName: '$body', pos, type, required: true } }
      if (pos === 'path') { pathParams[name] = { name, valName, pos, type, required: true } }
    })
    if (('requestBody' in methodSpec) && methodSpec.requestBody) {
      const pos = '$body'
      const { required = false, content } = methodSpec.requestBody
      const { schema } = content['application/json'] || {}
      if (schema) body = { name: pos, valName: pos, pos, type: this.typeDeep(schema), required }
    }
    const arrOf = {
      queries: Object.values(query),
      headers: Object.values(headers)
    }
    const params = Object.values(pathParams).filter((x): x is Parameter => !!x)
    params.push(...arrOf.queries)
    if (body) { params.push(body) }
    params.push(...arrOf.headers)
    const $config:Parameter = {
      name: '$config', valName: '$config', pos: '$config', type: 'AxiosRequestConfig', required: false
    }
    params.push($config)

    const axiosParams = [`\`${path.replace(/{/g, '${')}\``]
    if (body) { axiosParams[1] = body.name }
    {
      const noBody = /get|delete/.test(method)
      if (arrOf.headers.length || arrOf.queries.length) {
        const join = (arr: Parameter[]) => arr.map(x =>
          x.name === x.valName ? x.name : `'${x.name}': ${x.valName}`
        ).join(', ')
        const headers = arrOf.headers.length ? `headers: { ${join(arrOf.headers)} }` : ''
        const params = arrOf.queries.length ? `params: { ${join(arrOf.queries)} }` : ''
        axiosParams[noBody ? 1 : 2] = `{ ${[headers, params, '...' + $config.valName].filter(x => x).join(', ')} }`
      } else axiosParams[noBody ? 1 : 2] = $config.valName
    }
    const type = responses?.[200] ? this.getResponseType(responses[200]) : 'any'
    const paramsString = [...axiosParams].map(x => x || 'undefined').join(', ')
    const code = `${this.params(params)}: Promise<${type}> => this.$axios.$${method}(${paramsString})`
    return summary ? code + `/*${summary}*/` : code
  }

  pluginTemplate ({ properties }: { properties: string }) {
    return `
${noInspect}
import { Plugin } from '@nuxt/types'
import { AxiosRequestConfig } from 'axios'
import { NuxtAxiosInstance } from '@nuxtjs/axios'
${this.importTypes()}
${typeMatch}

class ${this.className} {
  public $axios: NuxtAxiosInstance
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
