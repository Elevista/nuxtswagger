/* eslint-disable no-control-regex */
import { Options } from './index'
import { camelCase, entries, keys } from './utils'
import * as v2 from './schema/v2/Spec'
import * as v3 from './schema/v3/Spec'
import { LoDashStatic } from 'lodash'
type ParameterIn = v2.ParameterIn | v3.ParameterIn | 'body' | '$config'
interface Parameter { type: string, required: boolean, name: string, valName: string, pos: ParameterIn, description: string }
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
const entriesCompare = <T>([a]: any[], [b]: any[]) => a.localeCompare(b)
const exists = <TValue>(value: TValue | null | undefined): value is TValue => (value ?? null) !== null
const noInspect = '/* eslint-disable */\n// noinspection ES6UnusedImports,JSUnusedLocalSymbols\n'
const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const replaceAll = (string: string, searchValue: string, replaceValue: string) => string.replace(new RegExp(escapeRegExp(searchValue), 'g'), replaceValue)
const genericVar = (i: number) => {
  const arr = ['T', 'U', 'V']
  return i < arr.length ? arr[i] : `T${i + 1 - arr.length}`
}

const prependText = {
  encode: (str: string) => str && '\x00' + str.replace(/\n/mg, '\x00') + '\x00',
  regex: /^([ ]*)(.+?)\x00(.*)\x00/mg,
  replacer: (_ = '', indent = '', text = '', prepend = '') => {
    return indent + [prepend.split('\x00'), text].flat().join('\n' + indent)
  }
}

export abstract class TemplateCommon {
  protected abstract spec: Spec
  protected readonly relTypePath: string
  protected readonly basePath: string
  protected readonly inject: string
  protected readonly skipHeader: boolean
  protected options: TemplateOptions;

  protected constructor (spec: Spec, options: TemplateOptions) {
    const { basePath, inject, skipHeader, relTypePath } = options
    this.relTypePath = relTypePath
    this.basePath = basePath
    this.skipHeader = skipHeader
    this.options = options
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
    if (!string) return ''
    if (lines.length === 1) { return `/** ${lines[0]} */` }
    return ['/**', ...lines.map(x => ` * ${x}`), ' */'].join('\n')
  }

  protected makeComment (typeObj: Exclude<TypeDefs, boolean>, onlyText = false) {
    const title = 'title' in typeObj ? this.comment(typeObj.title, true) : ''
    const description = 'description' in typeObj ? this.comment(typeObj.description, true) : ''
    const example = 'example' in typeObj ? this.comment(typeObj.example, true) : ''

    let comment: string
    if (title && description) comment = title + (/\n/.test(description) ? '\n' : ' - ') + description
    else comment = title + description
    if (example) comment += '\n@example' + ((/\n/.test(comment + example)) ? `\n${example}` : `  ${example}`)
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
    return typeDeep(typeObj) + prependText.encode(comment)
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
      return `${comment}export type ${genericReplacer(`${rawName} = ${this.typeDeep(type, 1, true)}`)}`.replace(prependText.regex, prependText.replacer)
    })
    return [noInspect, typeMatch, ...exports, ''].join('\n')
  }

  protected paramsDoc (parameters: (Parameter | Parameter[])[]) {
    let paramsArr = parameters.map((x, i) => {
      if (x instanceof Array) {
        x = x.filter(x => x.description)
        if (!x.length) return []
        return [
          { name: 'arg' + i, description: '' },
          x.map(({ valName, description }) => ({ name: 'arg' + i + '.' + valName, description }))
        ].flat()
      }
      return { name: x.valName, description: x.description }
    }).flat()
    const item = paramsArr.reverse().find(x => x.description)
    paramsArr = paramsArr.reverse().slice(0, item ? paramsArr.indexOf(item) + 1 : 0)
    return paramsArr.map(({ name, description }) => `@param ${[name, description].filter(x => x).join('  ')}`).join('\n')
  }

  protected documentation (path: string, method: Method) {
    const { deprecated } = method

    const { responses, returns } = (() => {
      const response = method.responses[200] || method.responses.default
      const useless = /^(OK|Successful)$/i.test(response?.description || '')
      const returns = useless ? '' : `@returns ${response?.description}`
      const responses = Object.keys(method.responses)
        .map((key, i, arr) => {
          if (arr.length === 1 && useless) return ''
          const value = method.responses[key]
          const description = value?.description
          if ((returns && value === response) || !description) return ''
          return `${key}: ${description}`
        }).filter(x => x).join('\n')
      return { responses, returns }
    })()

    const params = this.paramsDoc(this.groupParameters(path, method).parameters)
    const { description, summary } = method.description ? method : { description: method.summary, summary: '' }

    const paragraphs = [
      description,
      responses,
      [
        params, returns,
        summary && `@summary ${summary}`,
        deprecated && '@deprecated'
      ].filter(x => x).join('\n')
    ].filter(x => x).join('\n\n').trim()
    return this.comment(paragraphs)
  }

  protected pathMethodList (): [string, string, Methods][] {
    const { basePath: base, spec: { paths } } = this
    return entries(paths).sort(entriesCompare).map(([path, methods]) => [
      path,
      (path.startsWith(base + '/') ? path.replace(base, '') : path)
        .replace(/[^/{}\w]/g, '_')
        .replace(/^(\/v\d+)(\/.+)/, '$2$1')
        .replace(/([a-z\d])_([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase()), // foo_bar => fooBar
      methods
    ])
  }

  protected defaultForm () {
    type Map = [string, string, MethodTypes, Method] | { [key in string]: Map }
    const map: Map = {}
    this.pathMethodList().forEach(([orgPath, path, methods]) => {
      const paths = path.replace(/\/{(\w+)}/g, '/$1/\x00').split('/').slice(1)
      keys(methods).forEach(methodType => {
        const item: Map = [orgPath, path, methodType, methods[methodType]]
        _.set(map, [paths, methodType].flat(), item)
      })
    })
    const mapValues = <T, U>(obj: { [s: string]: T }, mapFn: (v: T, key?: string) => U): { [s: string]: U } =>
      Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, mapFn(value, key)]))
    const rec = (obj: Map, key?: string, params?: Parameter[]):any => {
      if (obj instanceof Array) {
        const [orgPath, path, methodType, method] = obj
        params?.push(...this.convertParameters(method).filter(x => x.pos === 'path'))
        const comment = prependText.encode(this.documentation(path, method))
        return comment + this.axiosCall(orgPath, methodType, method)
      }
      const { '\x00': pathParam, ...rest } = obj
      let fn = ''
      let other = ''
      if (pathParam && key !== undefined) {
        let p = (params || [])
        const content = rec(pathParam, key, p)
        p = p.filter((x) => x.name === key)
        const types = _.uniq(p.map((x) => this.typeDeep(x))).join(' | ') || 'any'
        const [longestComment = ''] = p.map(x => this.paramsDoc([x]))
          .sort((a, b) => b.length - a.length)
          .map(x => prependText.encode(this.comment(x)))
        fn = `${longestComment}(${key}: ${types}) => (${content})`.replace(/^ {2}/mg, '')
      }
      if (keys(rest).length) {
        const res = mapValues(rest, (v, key) => rec(v, key, params))
        other = JSON.stringify(res, null, '  ')
          .replace(/([^\\])(".+?[^\\]")/g, (_, m1, m2) => m1 + JSON.parse(m2))
      }
      return ((other && fn) ? `Object.assign(${fn}, ${other})` : (other || fn))
        .replace(/\n/mg, '\n  ')
    }
    const object = rec(map).replace(/^ {2}/mg, '')
    return { object }
  }

  protected underscoreForm () {
    type Tree = { [paths: string]: Tree | string[] }
    const propTree: Tree = {}
    const entries = this.pathMethodList()
    entries.forEach(([orgPath, path, methods]) => {
      const paths = path
        .replace(/{(\w+)}/g, '_$1') // {foo} => _foo
        .replace(/\/$/, '/$root')
        .split('/').slice(1)
      const entries = Object.entries(methods) as [MethodTypes, Method][]
      entries.sort(entriesCompare).forEach(([methodType, method]) => {
        const comment = prependText.encode(this.documentation(path, method))
        const fn = this.axiosCall(orgPath, methodType, method)
        _.set(propTree, [...paths, methodType], fn + comment)
      })
    })
    return { object: JSON.stringify(propTree, null, '  ') }
  }

  public plugin () {
    const { form } = this.options
    const prepend = (s: string) => s
      .replace(/([^\\])(".+?[^\\]")/g, (_, m1, m2) => m1 + JSON.parse(m2))
      .replace(prependText.regex, prependText.replacer)
    const tpl = ({ object }: { object: string }) => this.pluginTemplate({ object: prepend(object) })
    if (form === 'underscore') return tpl(this.underscoreForm())
    return tpl(this.defaultForm())
  }

  protected convertParameters (method: Method): Parameter[] {
    const { parameters = [] } = method
    const ret = parameters.map((parameter):Parameter => {
      const type = this.typeDeep(parameter)
      let { in: pos, required = /body|path/.test(pos), name, description = '' } = parameter
      if (pos === 'body') name = '$body'
      return { name, valName: camelCase(name), pos, type, required, description }
    })
    if (('requestBody' in method) && method.requestBody) {
      const { required = true, content, description = '' } = method.requestBody
      const { schema } = content['application/json'] || {}
      const name = '$body'
      if (schema) ret.push({ name, valName: name, pos: 'body', type: this.typeDeep(schema), required, description })
    }
    ret.push({ name: '$config', valName: '$config', pos: '$config', type: 'AxiosRequestConfig', required: false, description: '' })
    return this.skipHeader ? ret.filter(x => x.pos !== 'header') : ret
  }

  protected groupParameters (pathStr:string, method:Method) {
    const parameters = this.convertParameters(method)
    const [path = [], query = [], header = [], rest = []]:Parameter[][] = []
    let body:Parameter|undefined
    let config:Parameter|undefined
    for (const parameter of parameters) {
      const { pos } = parameter
      let type = []
      if (pos === 'path') type = path
      else if (pos === 'query') type = query
      else if (pos === 'body') body = parameter
      else if (pos === 'header') type = header
      else if (pos === '$config') config = parameter
      else type = rest
      type.push(parameter)
    }
    path.sort((a, b) => pathStr.indexOf(a.name) - pathStr.indexOf(b.name))
    const all = (() => {
      const _path = this.options.form === 'underscore' ? path : []
      const order = [_path, query, body, header, rest, config].flat().filter(exists)
      const [required = [], optional = []]: Parameter[][] = []
      for (const parameter of order) {
        parameter.required ? required.push(parameter) : optional.push(parameter)
      }
      return [required, optional].flat()
    })()
    if (this.options.form === 'underscore') {
      const tooMany = all.length - (path.length + (body ? 1 : 0)) >= 5
      const order = tooMany ? [path, body, [[...query, ...header]], rest, config] : all
      const parameters = order.flat().filter(exists)
      return { parameters, path, query, body, config, header, rest }
    } else {
      const object = [query, header, rest].flat().filter(exists)
      const parameters = (object.length > 2 ? [body, object, config] : all).filter(exists)
      return { parameters, path, query, body, config, header, rest }
    }
  }

  protected toArgs (parameters: (Parameter | Parameter[])[]) {
    const destructuredObject = (arr:Parameter[]) => {
      const keys = arr.map(x => x.valName).join(', ')
      const types = arr.map(x => `${x.valName}${x.required ? '' : '?'}: ${x.type}`).join(', ')
      return `{ ${keys} }: { ${types} }`
    }

    return parameters.map(x => {
      if (x instanceof Array) return destructuredObject(x)
      return `${x.valName}${x.required ? '' : '?'}: ${x.type}`
    }).join(', ')
  }

  protected axiosCall (path: string, methodType: MethodTypes, method: Method) {
    const { responses } = method
    const { parameters, body, config, header, query } = this.groupParameters(path, method)

    const axiosParams = [`\`${path.replace(/{/g, '${')}\``]
    const hasRequestBody = /post|put|patch/i.test(methodType)
    if (hasRequestBody) axiosParams.push(String(body?.valName))
    const data = !hasRequestBody && body ? `data: ${body.valName}` : ''
    if (header.length + query.length || data) {
      const join = (arr: Parameter[]) => arr.map(x =>
        x.name === x.valName ? x.name : `'${x.name}': ${x.valName}`
      ).join(', ')
      const headers = header.length ? `headers: { ${join(header)} }` : ''
      const params = query.length ? `params: { ${join(query)} }` : ''
      axiosParams.push(`{ ${[headers, params, data, config && ('...' + config.valName)].filter(x => x).join(', ')} }`)
    } else if (config) axiosParams.push(config.valName)

    const type = responses[200] ? this.getResponseType(responses[200]) : 'any'
    const paramsString = axiosParams.map(x => x || 'undefined').join(', ')
    return `(${this.toArgs(parameters)}): Promise<${type}> => $axios.$${methodType}(${paramsString})`
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
