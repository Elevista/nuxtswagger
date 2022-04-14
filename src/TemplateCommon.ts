/* eslint-disable no-control-regex */
import _ from 'lodash'
import { camelCase, entries, keys, notNullish, stringify } from './utils'
import * as v2 from './schema/v2/Spec'
import * as v3 from './schema/v3/Spec'
import { Options } from './index'
type ParameterIn = v2.ParameterIn | v3.ParameterIn | 'body' | '$config'
interface Parameter { type: string, required: boolean, name: string, valName: string, pos: ParameterIn, description: string, multipart?: boolean }
type Response = v2.Response | v3.Response
type TypeDefs = v2.Types | v2.ParameterTypes | v3.Types | v3.ParameterTypes | Required<v2.TypeObject | v3.TypeObject>['additionalProperties']
type Spec = v2.Spec | v3.Spec
type Methods = v2.Methods | v3.Methods
type Method = v2.Method | v3.Method
type Schemas = v2.Definitions | v3.Schemas

enum MethodTypes {get = 'get', post = 'post', put = 'put', patch = 'patch', delete = 'delete', head = 'head', options = 'options'}
export type TemplateOptions = Options & { relTypePath: string }
const typeMatchMap = {
  number: ['integer', 'long', 'float', 'double'],
  string: ['byte', 'binary', 'date', 'dateTime', 'password'],
}
const localeCompare = (a: string, b: string) => a.localeCompare(b)
const entriesCompare = ([a]: any[], [b]: any[]) => localeCompare(a, b)
const noInspect = '/* eslint-disable */\n// noinspection ES6UnusedImports,JSUnusedLocalSymbols\n'
const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const replaceAll = (string: string, searchValue: string, replaceValue: string) => string.replace(new RegExp(escapeRegExp(searchValue), 'g'), replaceValue)
const genericVar = (i: number, vars = ['T', 'U', 'V']) => i < vars.length ? vars[i] : `T${i + 1 - vars.length}`
const Multipart = '$multipart'

const prependText = {
  encode: (str: string) => str && `\x00${str.replace(/\n/mg, '\x00')}\x00`,
  regex: /^(\s*)(.+?)\x00(.*)\x00/mg,
  replacer: (_ = '', space = '', text = '', prepend = '') =>
    space + [prepend.split('\x00'), text].flat().join(`\n${space}`),
}

export abstract class TemplateCommon {
  protected abstract spec: Spec
  protected readonly relTypePath: string
  protected readonly basePath: string
  protected readonly inject: string
  protected readonly skipHeader: boolean
  protected options: TemplateOptions
  private hasMultipart = false

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

  protected comment (comment?: string | number | boolean | object, onlyText = false) {
    if (comment === undefined) return ''
    if (comment === Object(comment)) comment = JSON.stringify(comment)
    const string = comment.toString().trim().replace(/<br\/?>(\s)*/gi, '\n$1').replace(/\//g, '∕')
    if (onlyText) return string
    const lines = string.split('\n')
    if (!string) return ''
    if (lines.length === 1) return `/** ${lines[0]} */`
    return ['/**', ...lines.map(x => ` * ${x}`), ' */'].join('\n')
  }

  protected makeComment (typeObj: Exclude<TypeDefs, boolean>, onlyText = false) {
    const title = 'title' in typeObj ? this.comment(typeObj.title, true) : ''
    const description = 'description' in typeObj ? this.comment(typeObj.description, true) : ''
    const example = 'example' in typeObj ? this.comment(typeObj.example, true) : ''

    let comment: string
    if (title && description) comment = title + (/\n/.test(description) ? '\n' : ' - ') + description
    else comment = title + description
    if (example) comment += `\n@example${(/\n/.test(comment + example)) ? `\n${example}` : `  ${example}`}`
    return comment && this.comment(comment, onlyText)
  }

  protected typeDeep (typeObj: TypeDefs, maxIndent = -1, noComment = false): string {
    if (typeof typeObj === 'boolean') return 'any'
    const canComment = maxIndent >= 0 && !noComment
    const indentProps = maxIndent > 0
    const comment = canComment ? this.makeComment(typeObj) : ''
    const typeDeep = (typeObj: Exclude<TypeDefs, boolean>): string => {
      const nullable = (type: string): string => ('nullable' in typeObj && typeObj.nullable) ? `${type} | null` : type
      if ('schema' in typeObj) return typeDeep(typeObj.schema)
      if ('$ref' in typeObj) return (typeObj.$ref in this.schemas) ? typeObj.$ref : 'any'
      if ('allOf' in typeObj) return typeObj.allOf.map(typeDeep).join(' & ')
      if ('oneOf' in typeObj) return typeObj.oneOf.map(typeDeep).join(' | ')
      if ('enum' in typeObj) return nullable(typeObj.enum.map(x => JSON.stringify(x).replace(/"/g, '\'')).join(' | '))
      if (!('type' in typeObj)) return 'any'
      if (typeObj.type === 'file') return 'File'
      if (typeObj.type === 'array') return `Array<${typeDeep(typeObj.items)}>`.replace('Array<File>', 'File[] | FileList')
      if (typeObj.type === 'object') {
        const { properties, additionalProperties, required = [] } = typeObj
        const entries: [string, Exclude<TypeDefs, boolean>][] = properties ? Object.entries(properties) : []
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
      if (typeObj.type === 'string' && 'format' in typeObj && typeObj.format === 'binary') return nullable('File')
      return nullable(typeObj.type)
    }
    return typeDeep(typeObj) + prependText.encode(comment)
  }

  protected fixKeys<T extends object> (o?: T): T {
    const ret: any = {}
    if (o) Object.entries(o).forEach(([key, value]) => { ret[this.fixTypeName(key)] = value })
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

  protected get importTypes () {
    const withoutGeneric = _.uniq(Object.keys(this.schemas).map(x => x.replace(/<.+>/, ''))).sort(localeCompare)
    const typeMatches = Object.values(typeMatchMap).flat(2)
    return [withoutGeneric, typeMatches].filter(x => x.length)
      .map(types => `import { ${types.join(', ')} } from '${this.relTypePath}'`).join('\n')
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
      const comment = comments.length ? `${this.comment(comments.join('\n')).trim()}\n` : ''
      return `${comment}export type ${genericReplacer(`${rawName} = ${this.typeDeep(type, 1, true)}`)}`.replace(prependText.regex, prependText.replacer)
    })
    const typeMatch = entries(typeMatchMap).map(([jsType, list]) => list.map(swaggerType => `export type ${swaggerType} = ${jsType}`)).flat().join('\n')
    return [noInspect, ...exports, typeMatch, ''].join('\n')
  }

  protected paramsDoc (parameters: (Parameter | Parameter[])[]) {
    let paramsArr = parameters.map((x, i) => {
      if (x instanceof Array) {
        x = x.filter(x => x.description)
        if (!x.length) return []
        return [
          { name: `arg${i}`, description: '' },
          x.map(({ valName, description }) => ({ name: `arg${i}.${valName}`, description })),
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
        deprecated && '@deprecated',
      ].filter(x => x).join('\n'),
    ].filter(x => x).join('\n\n').trim()
    return this.comment(paragraphs)
  }

  protected pathMethodList (): [string, string, Methods][] {
    const { basePath: base, spec } = this
    const paths: { [k in string]: Methods } = spec.paths
    return entries(paths).sort(entriesCompare).map(([path, methods]) => [
      path,
      (path.startsWith(`${base}/`) ? path.replace(base, '') : path)
        .replace(/[^/{}\w]/g, '_')
        .replace(/^(\/v\d+)(\/.+)/, '$2$1')
        .replace(/([a-z\d])_([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase()), // foo_bar => fooBar
      methods,
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
    const deep = (obj: Map, key?: string, params?: Parameter[]) => {
      if (obj instanceof Array) {
        const [orgPath, path, methodType, method] = obj
        params?.push(...this.convertParameters(method).filter(x => x.pos === 'path'))
        const comment = prependText.encode(this.documentation(path, method))
        return comment + this.axiosCall(orgPath, methodType, method)
      }
      const { '\x00': pathParam, ...rest } = obj
      let [fn, other] = ['', '']
      if (pathParam && key !== undefined) {
        let p = (params || [])
        const content = deep(pathParam, key, p)
        p = p.filter(x => x.name === key)
        const types = _.uniq(p.map(x => this.typeDeep(x))).join(' | ') || 'any'
        const [longestComment = ''] = p.map(x => this.paramsDoc([x]))
          .sort((a, b) => b.length - a.length)
          .map(x => prependText.encode(this.comment(x)))
        fn = `${longestComment}(${key}: ${types}) => (${content})`
      }
      if (keys(rest).length) {
        const res = mapValues(rest, (v, key) => deep(v, key, params))
        other = stringify(res)
        if (key) other = other.replace(/\n/mg, '\n  ')
      }
      return ((fn && other) ? `Object.assign(${fn}, ${other})` : (fn || other))
    }
    return { object: deep(map) }
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
    return { object: stringify(propTree) }
  }

  public plugin () {
    const { form } = this.options
    const prepend = (s: string) => s
      .replace(prependText.regex, prependText.replacer)
    const tpl = ({ object }: { object: string }) => this.pluginTemplate({ object: prepend(object) })
    if (form === 'underscore') return tpl(this.underscoreForm())
    return tpl(this.defaultForm())
  }

  protected convertParameters (method: Method): Parameter[] {
    const { parameters = [] } = method
    const ret = parameters.map((parameter): Parameter | undefined => {
      if (!parameter.name) return undefined
      const type = this.typeDeep(parameter)
      let { in: pos, required = /body|path/.test(pos), name, description = '' } = parameter
      if (pos === 'body') name = '$body'
      if (pos === 'formData') this.hasMultipart = true
      return { name, valName: camelCase(name), pos, type, required, description }
    }).filter(notNullish)
    if (('requestBody' in method) && method.requestBody) {
      const { required = true, content, description = '' } = method.requestBody
      const { schema } = content['application/json'] || content['multipart/form-data'] || {}
      const multipart = !!content['multipart/form-data']
      if (multipart) this.hasMultipart = true
      const name = '$body'
      if (schema) ret.push({ name, valName: name, pos: 'body', type: this.typeDeep(schema), required, description, multipart })
    }
    ret.push({ name: '$config', valName: '$config', pos: '$config', type: 'AxiosRequestConfig', required: false, description: '' })
    return this.skipHeader ? ret.filter(x => x.pos !== 'header') : ret
  }

  protected groupParameters (pathStr: string, method: Method) {
    const parameters = this.convertParameters(method)
    const [path = [], query = [], header = [], formData = [], rest = []]: Parameter[][] = []
    let body: Parameter | undefined
    let config: Parameter | undefined
    for (const parameter of parameters) {
      const { pos } = parameter
      let type = []
      if (pos === 'path') type = path
      else if (pos === 'query') type = query
      else if (pos === 'body') body = parameter
      else if (pos === 'header') type = header
      else if (pos === 'formData') type = formData
      else if (pos === '$config') config = parameter
      else type = rest
      type.push(parameter)
    }
    path.sort((a, b) => pathStr.indexOf(a.name) - pathStr.indexOf(b.name))
    const all = (() => {
      const _path = this.options.form === 'underscore' ? path : []
      const order = [_path, query, body, formData, header, rest, config].flat().filter(notNullish)
      const [required = [], optional = []]: Parameter[][] = []
      for (const parameter of order) (parameter.required ? required : optional).push(parameter)
      return [required, optional].flat()
    })()
    if (this.options.form === 'underscore') {
      const tooMany = all.length - (path.length + (body ? 1 : 0)) >= 5
      const order = tooMany ? [path, body, [[query, formData, header].flat()], rest, config] : all
      const parameters = order.flat().filter(notNullish)
      return { parameters, path, query, body, formData, config, header, rest }
    } else {
      const object = [query, formData, header, rest].flat().filter(notNullish)
      const parameters = (object.length > 2 ? [body, object, config] : all).filter(notNullish)
      return { parameters, path, query, body, formData, config, header, rest }
    }
  }

  protected toArgs (parameters: (Parameter | Parameter[])[]) {
    const destructuredObject = (arr: Parameter[]) => {
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
    const { parameters, body, formData, config, header, query } = this.groupParameters(path, method)

    const axiosParams = [`\`${path.replace(/{/g, '${')}\``]

    let bodyParam = ''
    if (formData.length) {
      const valNames = formData.map(x => x.valName).join(', ')
      bodyParam = `${Multipart}({ ${valNames} })`
    } else if (body) {
      const { valName, multipart } = body
      bodyParam = multipart ? `${Multipart}(${valName})` : valName
    }

    const hasRequestBody = /post|put|patch/i.test(methodType)
    if (hasRequestBody) axiosParams.push(bodyParam || 'undefined')
    const data = (hasRequestBody || !bodyParam) ? '' : `data: ${bodyParam}`

    if (header.length + query.length || data) {
      const join = (arr: Parameter[]) => arr.map(x =>
        x.name === x.valName ? x.name : `'${x.name}': ${x.valName}`,
      ).join(', ')
      const headers = header.length ? `headers: { ${join(header)} }` : ''
      const params = query.length ? `params: { ${join(query)} }` : ''
      axiosParams.push(`{ ${[headers, params, data, config && (`...${config.valName}`)].filter(x => x).join(', ')} }`)
    } else if (config) axiosParams.push(config.valName)

    const type = responses[200] ? this.getResponseType(responses[200]) : 'any'
    const paramsString = axiosParams.map(x => x || 'undefined').join(', ')
    return `(${this.toArgs(parameters)}): Promise<${type}> => $axios.$${methodType}(${paramsString})`
  }

  protected pluginFunction (object: string) {
    const { axiosConfig, pluginName } = this.options
    const ret = `exposureAxios(${object}, $axios)`
    if (!axiosConfig) return `({ $axios }: Context) => ${ret}`
    const code = `
$axios = $axios.create([$config.nuxtswagger].flat().find(x => x?.pluginName === '${pluginName}')?.axiosConfig)
return ${ret}
`.trim().replace(/^/mg, '  ')
    return `({ $axios, $config }: Context) => {\n${code}\n}`
  }

  protected pluginTemplate ({ object }: { object: string }) {
    const { importTypes, inject, hasMultipart } = this
    const multipart = hasMultipart
      ? `const ${Multipart} = (o: any) => {
  if (!(o instanceof Object)) return o
  const formData = new FormData()
  for (const [key, v] of Object.entries(o)) {
    const append = (v: any) => v !== undefined && formData.append(key, v instanceof Blob ? v : String(v))
    const files = (files: File | File[] | FileList) => {
      const list = files instanceof File ? [files] : files
      for (let i = 0; i < list.length; i++) formData.append(key, list[i], list[i].name)
    }
    if (v instanceof Array) v.forEach(item => (item instanceof File) ? files(item) : append(item))
    else if (v instanceof FileList || v instanceof File) files(v)
    else append(v)
  }
  return formData
}`
      : ''
    return `
${noInspect}
import { Context, Plugin } from '@nuxt/types'
import { AxiosRequestConfig } from 'axios'
${importTypes}

const $${inject} = ${this.pluginFunction(object)}
${multipart}
const exposureAxios = <T, V> (o: T, value: V) => Object.defineProperty(o, '$axios', { value }) as T & { readonly $axios: V }
declare module '@nuxt/types' {
  interface Context { $${inject}: ReturnType<typeof $${inject}> }
  interface NuxtAppOptions { $${inject}: ReturnType<typeof $${inject}> }
}
declare module 'vue/types/vue' {
  interface Vue { $${inject}: ReturnType<typeof $${inject}> }
}
declare module 'vuex/types/index' {
  interface Store<S> { $${inject}: ReturnType<typeof $${inject}> }
}
export default ((context, inject) => inject('${inject}', $${inject}(context))) as Plugin
`.trimStart()
  }
}
