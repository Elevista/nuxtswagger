import { V2T, V3T, V2spec, V3spec, TemplateCommon } from 'tswagger'
import { Options } from './cli'
export type NuxtTemplateOptions = Options & { relTypePath: string }

interface NuxtTemplate extends TemplateCommon {
  hasAxiosConfig: boolean
  pluginFunction: (object: string) => string
}
// type NuxtTemplate = TemplateCommon
function axiosArrowFn (args: string, returnType: string, methodType: string, params: string) {
  return `(${args}): Promise<${returnType}> => $axios.$${methodType}(${params})`
}
function pluginFunction (this: NuxtTemplate, object: string) {
  const { pluginName } = this.options
  const ret = `exposureAxios(${object}, $axios)`
  if (!this.hasAxiosConfig) return `({ $axios }: Context) => ${ret}`
  const code = `
$axios = $axios.create([$config.nuxtswagger].flat().find(x => x?.pluginName === '${pluginName}')?.axiosConfig)
return ${ret}
`.trim().replace(/^/mg, '  ')
  return `({ $axios, $config }: Context) => {\n${code}\n}`
}

function pluginTemplate (this: NuxtTemplate, { object }: { object: string }) {
  const { importTypes, multipart, noInspect } = this
  const inject = this.options.exportName
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
export class V2 extends V2T {
  protected hasAxiosConfig: boolean
  protected pluginFunction: (this: NuxtTemplate, object: string) => string
  constructor (spec: V2spec, options: NuxtTemplateOptions) {
    const { inject, ...rest } = options
    super(spec, { ...rest, exportName: inject })
    this.hasAxiosConfig = !!options.axiosConfig
    this.pluginFunction = pluginFunction
    this.pluginTemplate = pluginTemplate
    this.axiosArrowFn = axiosArrowFn
  }
}

export class V3 extends V3T {
  protected hasAxiosConfig: boolean
  protected pluginFunction: (this: NuxtTemplate, object: string) => string

  constructor (spec: V3spec, options: NuxtTemplateOptions) {
    const { inject, ...rest } = options
    super(spec, { ...rest, exportName: inject })
    this.hasAxiosConfig = !!options.axiosConfig
    this.pluginFunction = pluginFunction
    this.pluginTemplate = pluginTemplate
    this.axiosArrowFn = axiosArrowFn
  }
}
