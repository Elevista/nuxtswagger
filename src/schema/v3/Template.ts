import { Method, MethodTypes, Types, TypeArray, TypeObject, ParameterTypes, Spec, Schemas, ParameterPositions } from './Spec'
import { TemplateBase, TemplateOptions } from '../../TemplateBase'
import { camelCase } from '../../utils'
interface Parameter { type: string, required: boolean, name: string, valName:string, pos: ParameterPositions | '$body' | '$config' }
const _ = require('lodash')
const exists = <TValue>(value: TValue | null | undefined): value is TValue => !!value

export default class Template extends TemplateBase {
  private readonly spec:Spec

  constructor (spec: Spec, options: TemplateOptions) {
    super(options)
    this.spec = this.fixDefDeep(spec)
  }

  fixDefDeep (spec:Spec) {
    const schemas:Schemas = {}
    const fix = (name: string) => name
      .replace(/^#\/components\/schemas\//, '')
      .replace(/«/g, '_of_')
      .replace(/[» ]+/g, '')
      .replace(/[^0-9a-zA-Z_$]/g, '')
      .replace(/.+/, camelCase)
    Object.entries(spec.components.schemas).forEach(([key, value]) => {
      schemas[fix(key)] = value
    })
    spec.components.schemas = schemas
    const deep = (o:any) => {
      if (!(o instanceof Object)) return
      if ('$ref' in o) o.$ref = fix(o.$ref)
      else if (o instanceof Array) o.forEach(deep)
      else Object.values(o).forEach(deep)
    }
    deep(spec)
    return spec
  }

  importTypes () {
    return `import { ${Object.keys(this.spec.components.schemas).join(', ')} } from '${this.relTypePath}'`
  }

  comment (comment?:string|number|boolean|object) {
    if (comment === undefined) { return '' }
    if (comment === Object(comment)) comment = JSON.stringify(comment)
    const lines = comment.toString().trim().split('\n')
    if (lines.length === 1) { return ` // ${lines[0]}` }
    return ['\n/**', ...lines.map(x => ` * ${x}`), ' */'].join('\n')
  }

  typeDeep (typeObj:Types|ParameterTypes):string {
    if ('schema' in typeObj) return this.typeDeep(typeObj.schema)
    if ('$ref' in typeObj) return typeObj.$ref
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

  definitions () {
    const { schemas } = this.spec.components
    const array = (name:string, definition:TypeArray) => {
      const type = this.typeDeep(definition)
      return `export type ${name} = ${type}`
    }
    const object = (name:string, { properties, required }:TypeObject) => {
      const content = Object.entries(properties || {}).map(([property, definition]) => {
        const type = this.typeDeep(definition)
        const optional = required?.includes(property) ? '' : '?'
        const title = ('title' in definition) ? this.comment(definition.title) : ''
        const example = ('example' in definition) ? this.comment(definition.example) : ''
        let comment = title
        if (example.startsWith('\n')) comment += example
        else if (title && example) comment += example.replace('// ', '(') + ')'
        return `${property}${optional}: ${type}${comment}`
      }).join('\n').replace(/^(.)/mg, '  $1')
      return `export interface ${name} {\n${content}\n}`
    }
    return this.definitionsTemplate({
      definitions: Object.entries(schemas).map(([name, definition]) => {
        if ('type' in definition) {
          if (definition.type === 'array') return array(name, definition)
          if (definition.type === 'object') return object(name, definition)
        }
        return undefined
      }).filter(x => x).join('\n')
    })
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

  axiosCall (path: string, method: MethodTypes, { requestBody, parameters, responses, summary }: Method) {
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
      if (pos === 'path') { pathParams[name] = { name, valName, pos, type, required: true } }
    })
    if (requestBody) {
      const pos = '$body'
      const { required = false, content } = requestBody
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
    const schema:Types|{} = responses?.[200].content?.['application/json']?.schema || {}
    let type = 'any'
    if ('type' in schema) type = schema.type
    if ('$ref' in schema) type = schema.$ref
    const paramsString = [...axiosParams].map(x => x || 'undefined').join(', ')
    const code = `${this.params(params)}: Promise<${type}> => this.$axios.$${method}(${paramsString})`
    return summary ? code + `/*${summary}*/` : code
  }

  plugin () {
    const { paths } = this.spec
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
    return this.pluginTemplate({ properties })
  }
}
