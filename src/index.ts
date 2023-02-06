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

declare module '@nuxt/types/config/runtime' {
  interface NuxtRuntimeConfig {
    nuxtswagger?: Partial<NuxTSwaggerOptions> | Partial<NuxTSwaggerOptions>[]
  }
}
