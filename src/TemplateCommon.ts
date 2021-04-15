import { Options } from './index'
import { camelCase } from './utils'
import * as v2 from './schema/v2/Spec'
import * as v3 from './schema/v3/Spec'
import { LoDashStatic } from 'lodash'
type ParameterPositions = v2.ParameterPositions| v3.ParameterPositions
interface Parameter { type: string, required: boolean, name: string, valName:string, pos: ParameterPositions | '$body' | '$config' }
type Response = v2.Response | v3.Response
type TypeDefs = v2.Types | v2.ParameterTypes | v3.Types | v3.ParameterTypes | {} | Boolean
type Spec = v2.Spec | v3.Spec
type Method = v2.Method | v3.Method
type Schemas = v2.Definitions | v3.Schemas

enum MethodTypes {get = 'get', post = 'post', put = 'put', patch = 'patch', delete = 'delete', head = 'head', options = 'options'}
export type TemplateOptions = Options & { relTypePath: string }

const _:LoDashStatic = require('lodash')
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

  makeComment (typeObj: Exclude<TypeDefs, boolean>) {
    const title = ('title' in typeObj) ? this.comment(typeObj.title) : ''
    const example = ('example' in typeObj) ? this.comment(typeObj.example) : ''
    let comment = title
    if (example.startsWith('\n')) comment += example
    else if (title && example) comment += example.replace('// ', '(') + ')'
    return comment
  }

  typeDeep (typeObj:TypeDefs, multiline = false, noComment = false):string {
    if (typeof typeObj === 'boolean') return 'any'
    const comment = noComment ? '' : this.makeComment(typeObj)
    const typeDeep = (typeObj:TypeDefs, multiline = false) :string => {
      if ('schema' in typeObj) return typeDeep(typeObj.schema, multiline)
      if ('$ref' in typeObj) return (typeObj.$ref in this.schemas) ? typeObj.$ref : 'any'
      if ('enum' in typeObj) {
        return `(${typeObj.enum.map(x => JSON.stringify(x).replace(/"/g, '\'')).join(' | ')})`
      }
      if (!('type' in typeObj)) return 'any'
      if (typeObj.type === 'array') return `Array<${typeDeep(typeObj.items)}>`
      if (typeObj.type === 'object') {
        const { properties, additionalProperties, required = [] } = typeObj
        const entries:[string, TypeDefs][] = Object.entries(properties || {})
        if (additionalProperties) entries.push(['[key in any]', additionalProperties])
        if (!entries.length) return 'any'
        const items = entries.map(([name, value]) => {
          const is = { required: false, ...value }
          const optional = (is.required || required.includes(name)) ? '' : '?'
          return `${name + optional}: ${this.typeDeep(value)}`
        })
        if (!multiline) return `{ ${items.join(', ')} }`
        return `{\n${items.join('\n').replace(/^./gm, '  $&')}\n}`
      }
      return typeObj.type
    }
    return typeDeep(typeObj, multiline) + comment
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
    const types = Object.entries(this.schemas).sort(entriesCompare)
      .map(([rawName, type]) => {
        const [, name = rawName, genericString = ''] = rawName.match(/(.+?)<(.+)>/) || []
        const generics = genericString
          .replace(/<.+>/, x => x.replace(/,/g, '\x00'))
          .split(',')
          .map(x => x.replace(/\x00/g, ',')) // eslint-disable-line no-control-regex
          .filter(x => x)
        const genericReplacer = (str:string) => {
          generics
            .map((x, i) => [x, genericVar(i)])
            .sort(([a], [b]) => b.length - a.length)
            .forEach(([x, t]) => { str = str.replace(new RegExp(escapeRegExp(x), 'g'), t) })
          return str
        }
        return { name, rawName, genericReplacer, type }
      })
    const exports = Object.values(_.groupBy(types, x => x.name)).map(arr => {
      const [{ rawName, genericReplacer, type }] = arr
      const comments = arr.map(x => this.makeComment(x.type).trim()).filter(x => x)
      const comment = comments.length ? comments.concat('').join('\n') : ''
      return `${comment}export type ${genericReplacer(`${rawName} = ${this.typeDeep(type, true, true)}`)}`
    })
    return [noInspect, typeMatch, ...exports, ''].join('\n')
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
