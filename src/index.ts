import { AxiosRequestConfig } from 'axios'

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
export type NuxTSwaggerOptions = NuxTSwaggerCliOptions & { axiosConfig?: AxiosRequestConfig }

declare module '@nuxt/schema' {
  interface NuxtConfig {
    nuxtswagger?: Partial<NuxTSwaggerOptions> | Partial<NuxTSwaggerOptions>[]
  }
  interface PublicRuntimeConfig {
    nuxtswagger?: Partial<NuxTSwaggerOptions> | Partial<NuxTSwaggerOptions>[]
  }
}
