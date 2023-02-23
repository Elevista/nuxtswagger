import { AxiosStatic } from 'axios'

export interface NuxTSwaggerCliOptions {
  src: string
  pluginsDir: string
  pluginName: string
  inject: string
  typePath: string
  basePath: string
  skipHeader: boolean
  form?: 'underscore'
}
type AxiosConfig = Required<Parameters<AxiosStatic['create']>>[0]
export type NuxTSwaggerOptions = NuxTSwaggerCliOptions & { axiosConfig?: AxiosConfig }

declare module '@nuxt/schema' {
  interface NuxtConfig {
    nuxtswagger?: Partial<NuxTSwaggerCliOptions> | Partial<NuxTSwaggerCliOptions>[]
  }
  interface PublicRuntimeConfig {
    nuxtswagger?: Partial<NuxTSwaggerOptions> | Partial<NuxTSwaggerOptions>[]
  }
}
