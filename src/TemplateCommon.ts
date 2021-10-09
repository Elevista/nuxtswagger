/* eslint-disable no-control-regex */
import { Options } from './index'
import { camelCase } from './utils'
import * as v2 from './schema/v2/Spec'
import * as v3 from './schema/v3/Spec'
import { LoDashStatic } from 'lodash'
type ParameterIn = v2.ParameterIn | v3.ParameterIn | '$body' | '$config'
interface Parameter { type: string, required: boolean, name: string, valName: string, pos: ParameterIn }
type Response = v2.Response | v3.Response
type TypeDefs = v2.Types | v2.ParameterTypes | v3.Types | v3.ParameterTypes | {} | Boolean
type Spec = v2.Spec | v3.Spec
type Methods = v2.Methods | v3.Methods
type Method = v2.Method | v3.Method
type Schemas = v2.Definitions | v3.Schemas

enum MethodTypes {get = 'get', post = 'post', put = 'put', patch = 'patch', delete = 'delete', head = 'head', options = 'options'}
export type TemplateOptions = Options & { relTypePath: string }

const _: LoDashStatic = require('lodash')
const typeMatch = ['integer', 'long'].map(x => `type ${x} = number`).join('\n')
const entriesCompare = <T>([a]: [string, T], [b]: [string, T]) => a.localeCompare(b)
const exists = <TValue>(value: TValue | null | undefined): value is TValue => !!value
const noInspect = '/* eslint-disable */\n// noinspection ES6UnusedImports,JSUnusedLocalSymbols\n'
const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const replaceAll = (string: string, searchValue: string, replaceValue: string) => string.replace(new RegExp(escapeRegExp(searchValue), 'g'), replaceValue)
const genericVar = (i: number) => {
  const arr = ['T', 'U', 'V']
  return i < arr.length ? arr[i] : `T${i + 1 - arr.length}`
}

export abstract class TemplateCommon {
  protected abstract spec: Spec
  protected readonly relTypePath: string
  protected readonly basePath: string
  protected readonly inject: string
  protected readonly skipHeader: boolean
  protected constructor (spec: Spec, { pluginName, basePath, inject, skipHeader, relTypePath }: TemplateOptions) {
    this.relTypePath = relTypePath
    this.basePath = basePath
    this.skipHeader = skipHeader
    this.inject = inject.replace(/^[^a-zA-Z]+/, '').replace(/^[A-Z]/, x => x.toLowerCase())
    this.fixRefDeep(spec)
  }

  protected abstract get schemas(): Schemas
  protected abstract getResponseType(response: Response): string

  protected fixTypeName = (name: string) => name
    .replace(/^#\/(components\/schemas|definitions)\//, '')
    .replace(/«/g, '<').replace(/»/g, '>')
    .replace(/List<(.+?)>/g, 'Array<$1>')
    .replace(/[^0-9a-zA-Z_$<>, ]/g, '')
    .replace(/.+/, camelCase)
    .replace(/[ ]+$/g, '')

  protected comment (comment?: string|number|boolean|object, onlyText = false) {
    if (comment === undefined) { return '' }
    if (comment === Object(comment)) comment = JSON.stringify(comment)
    const string = comment.toString().trim()
    if (onlyText) return string
    const lines = string.split('\n')
    if (lines.length === 1) { return ` // ${lines[0]}` }
    return ['\n/**', ...lines.map(x => ` * ${x}`), ' */'].join('\n')
  }

  protected makeComment (typeObj: Exclude<TypeDefs, boolean>, onlyText = false) {
    const title = 'title' in typeObj ? this.comment(typeObj.title, true) : ''
    const description = 'description' in typeObj ? this.comment(typeObj.description, true) : ''
    const example = 'example' in typeObj ? this.comment(typeObj.example, true) : ''

    let comment: string
    if (title && description) comment = title + (/\n/.test(description) ? '\n' : ' - ') + description
    else comment = title + description
    if (example) comment += (/\n/.test(comment + example)) ? `\n${example}` : ` (${example})`
    return comment && this.comment(comment, onlyText)
  }

  protected typeDeep (typeObj: TypeDefs, maxIndent = -1, noComment = false): string {
    if (typeof typeObj === 'boolean') return 'any'
    const canComment = maxIndent >= 0 && !noComment
    const indentProps = maxIndent > 0
    const comment = canComment ? this.makeComment(typeObj) : ''
    const typeDeep = (typeObj: TypeDefs): string => {
      if ('schema' in typeObj) return typeDeep(typeObj.schema)
      if ('$ref' in typeObj) return (typeObj.$ref in this.schemas) ? typeObj.$ref : 'any'
      if ('enum' in typeObj) {
        return `(${typeObj.enum.map(x => JSON.stringify(x).replace(/"/g, '\'')).join(' | ')})`
      }
      if (!('type' in typeObj)) return 'any'
      if (typeObj.type === 'array') return `Array<${typeDeep(typeObj.items)}>`
      if (typeObj.type === 'object') {
        const { properties, additionalProperties, required = [] } = typeObj
        const entries: [string, TypeDefs][] = Object.entries(properties || {})
        if (additionalProperties) entries.push(['[key in any]', additionalProperties])
        if (!entries.length) return 'any'
        const items = entries.map(([name, value]) => {
          const is = { required: false, ...value }
          const optional = (is.required || required.includes(name)) ? '' : '?'
          return `${name + optional}: ${this.typeDeep(value, maxIndent - 1)}`
        })
        if (!indentProps) return `{ ${items.join(', ')} }`
        return `{\n${items.join('\n').replace(/^./gm, '  $&')}\n}`
      }
      return typeObj.type
    }
    return typeDeep(typeObj) + comment
  }

  protected toArgs (parameters: Parameter[]) {
    const classify = (params: Parameter[] = []) => {
      const [names, all, required, optional] = [[], [], [], []] as string[][]
      params.forEach((p) => {
        names.push(p.valName)
        const type = `${p.valName}${p.required ? '' : '?'}: ${p.type}`
        all.push(type)
        p.required ? required.push(type) : optional.push(type)
      })
      return { names, types: { all, required, optional, ordered: [...required, ...optional] } }
    }
    const toArgs = (parameters: Parameter[]) => {
      const { path = [], body = [], $config, ...others } = _.groupBy(parameters, x => x.pos)
      if ((parameters.length - (path.length + body.length)) < 5) return classify(parameters).types.ordered
      const pathBody = classify([...path, ...body]).types.all // should be no optional type in path and body
      const { names, types } = classify(Object.values(others).flat())
      const objectArg = `{ ${names.join(', ')} }: { ${types.all.join(', ')} }`
      return [pathBody, objectArg, classify($config).types.all].flat()
    }
    return toArgs(parameters).join(', ')
  }

  protected fixKeys<T extends object> (o: T): T {
    const ret: any = {}
    Object.entries(o).forEach(([key, value]) => { ret[this.fixTypeName(key)] = value })
    return ret
  }

  protected fixRefDeep (spec: Spec) {
    const deep = (o: any) => {
      if (!(o instanceof Object)) return
      if ('$ref' in o) o.$ref = this.fixTypeName(o.$ref)
      else if (o instanceof Array) o.forEach(deep)
      else Object.values(o).forEach(deep)
    }
    deep(spec)
  }

  protected importTypes () {
    const withoutGeneric = Object.keys(this.schemas).map(x => x.replace(/<.+>/, ''))
    return `import { ${_.uniq(withoutGeneric).sort().join(', ')} } from '${this.relTypePath}'`
  }

  public definitions () {
    const types = Object.entries(this.schemas).sort(entriesCompare)
      .map(([rawName, type]) => {
        const [, name = rawName, genericString = ''] = rawName.match(/(.+?)<(.+)>/) || []
        const genericReplacer = (str: string) => {
          const generics = genericString
            .replace(/<.+>/, x => x.replace(/,/g, '\x00'))
            .split(',')
            .map(x => x.replace(/\x00/g, ','))
            .filter(x => x)
          generics
            .map((x, i) => [x, genericVar(i)])
            .sort(([a], [b]) => b.length - a.length) // length desc
            .forEach(([x, t]) => { str = replaceAll(str, x, t) })
          return str
        }
        return { name, rawName, genericReplacer, type }
      })
    const exports = Object.values(_.groupBy(types, x => x.name)).map(arr => {
      const [{ rawName, genericReplacer, type }] = arr
      const comments = arr.map(x => this.makeComment(x.type, true)).filter(x => x)
      const comment = comments.length ? this.comment(comments.join('\n')).trim() + '\n' : ''
      return `${comment}export type ${genericReplacer(`${rawName} = ${this.typeDeep(type, 1, true)}`)}`
    })
    return [noInspect, typeMatch, ...exports, ''].join('\n')
  }

  protected methodDescription (method:Method) {
    const statusList = Object.keys(method.responses)
    const responses = statusList
      .map(key => {
        const [status, { description }] = [+key, method.responses[+key] || {}]
        return description ? { status, description } : undefined
      }).filter(exists)
      .filter((x, _, { length }) => !(length === 1 && x.status === 200 && /^(OK|Successful)$/i.test(x.description)))
      .map(x => `${x.status}: ${x.description}`)
    const ret = [method.summary, ...responses].filter(x => x)
    return ret.length ? this.comment(ret.join('\n')).trimStart() + '\n' : ''
  }

  public plugin () {
    const { paths } = this.spec
    type Tree = { [paths: string]: Tree | string[] }
    const propTree: Tree = {}
    const base = this.basePath
    const entries: [string, Methods][] = Object.entries(paths)
    const singleLine = {
      encode: (str: string) => str.replace(/\n/mg, '\x00'),
      regex: /^([ ]*)((.|\x00)+)/mg,
      replacer: (_ = '', indent = '', match = '') => {
        return indent + match.split('\x00').join('\n' + indent)
      }
    }
    entries.sort(entriesCompare).forEach(([path, methods]) => {
      const paths = (path.startsWith(base + '/') ? path.replace(base, '') : path)
        .replace(/[^/{}\w]/g, '_')
        .replace(/([a-z\d])_([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase()) // foo_bar => fooBar
        .replace(/{(\w+)}/g, '_$1') // {foo} => _foo
        .replace(/\/$/, '/$root')
        .split('/').slice(1)
      if (/^v\d+$/.test(paths[0])) paths.push(paths.shift() || '')
      const entries = Object.entries(methods) as [MethodTypes, Method][]
      entries.sort(entriesCompare).forEach(([methodType, method]) => {
        const key = singleLine.encode(this.methodDescription(method) + methodType)
        _.set(propTree, [...paths, key], this.axiosCall(path, methodType, method))
      })
    })
    const object = JSON.stringify(propTree, null, '  ')
      .replace(/".+?"/g, JSON.parse)
      .replace(singleLine.regex, singleLine.replacer)
    return this.pluginTemplate({ object })
  }

  protected axiosCall (path: string, method: MethodTypes, methodSpec: Method) {
    const { parameters, responses } = methodSpec
    const pathParams: { [key in string]?: Parameter } = _(path.match(/{.+?}/g))
      .map((x) => x.replace(/[{}]/g, '')).zipObject().value()
    let body: Parameter | undefined
    const [headers, query]: { [x in string]: Parameter }[] = [{}, {}]
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
    const arrOf = { queries: Object.values(query), headers: Object.values(headers) }
    const params = Object.values(pathParams).filter((x): x is Parameter => !!x)
    params.push(...arrOf.queries)
    if (body) { params.push(body) }
    params.push(...arrOf.headers)
    const $config: Parameter = {
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
    const type = responses[200] ? this.getResponseType(responses[200]) : 'any'
    const paramsString = [...axiosParams].map(x => x || 'undefined').join(', ')
    return `(${this.toArgs(params)}): Promise<${type}> => $axios.$${method}(${paramsString})`
  }

  protected pluginTemplate ({ object }: { object: string }) {
    return `
${noInspect}
import { Context, Plugin } from '@nuxt/types'
import { AxiosRequestConfig } from 'axios'
${this.importTypes()}
${typeMatch}

const $${this.inject} = ({ $axios }: Context) => (${object})

declare module '@nuxt/types' {
  interface Context { $${this.inject}: ReturnType<typeof $${this.inject}> }
  interface NuxtAppOptions { $${this.inject}: ReturnType<typeof $${this.inject}> }
}
declare module 'vue/types/vue' {
  interface Vue { $${this.inject}: ReturnType<typeof $${this.inject}> }
}
declare module 'vuex/types/index' {
  interface Store<S> { $${this.inject}: ReturnType<typeof $${this.inject}> }
}

const plugin: Plugin = (context, inject) => {
  inject('${this.inject}', $${this.inject}(context))
}
export default plugin
`.trimStart()
  }
}
