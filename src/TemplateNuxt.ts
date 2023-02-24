import { V2T, V3T, V2spec, V3spec, TemplateCommon } from 'tswagger'
import { NuxTSwaggerOptions as Options } from './index'
export type NuxtTemplateOptions = Options & { relTypePath: string }

interface NuxtTemplate extends TemplateCommon {
  hasAxiosConfig: boolean
}

function pluginTemplate (this: NuxtTemplate, { object }: { object: string }) {
  const { importTypes, multipart, noInspect, options: { pluginName }, hasAxiosConfig, exportCode } = this
  const axiosConfig = hasAxiosConfig ? `[useRuntimeConfig().public.nuxtswagger].flat().find(x => x?.pluginName === '${pluginName}')?.axiosConfig || {}` : '{}'
  return `
${noInspect}
import Axios, { AxiosStatic, AxiosRequestConfig, AxiosResponse } from 'axios'
${importTypes}
export interface $customExtendResponse {}
type $R<T> = Promise<T> & { readonly response: Promise<AxiosResponse<T> & $customExtendResponse> }
export const $axiosConfig: Required<Parameters<AxiosStatic['create']>>[0] = ${axiosConfig}
const $ep = (_: any) => (${object})
${exportCode}
${multipart}
`.trimStart()
}
export class V2 extends V2T {
  protected hasAxiosConfig: boolean
  constructor (spec: V2spec, options: NuxtTemplateOptions) {
    const { inject, ...rest } = options
    super(spec, { ...rest, exportName: inject })
    this.hasAxiosConfig = !!options.axiosConfig
    this.pluginTemplate = pluginTemplate
  }
}

export class V3 extends V3T {
  protected hasAxiosConfig: boolean
  constructor (spec: V3spec, options: NuxtTemplateOptions) {
    const { inject, ...rest } = options
    super(spec, { ...rest, exportName: inject })
    this.hasAxiosConfig = !!options.axiosConfig
    this.pluginTemplate = pluginTemplate
  }
}
