import { AxiosStatic } from 'axios'

export interface NuxTSwaggerCliOptions {
  src: string
  pluginsDir: string
  pluginName: string
  exportName: string
  typePath: string
  basePath: string
}
export type AxiosConfig = Required<Parameters<AxiosStatic['create']>>[0]
export type NuxTSwaggerOptions = NuxTSwaggerCliOptions & { axiosConfig?: AxiosConfig }

declare module '@nuxt/schema' {
  interface NuxtConfig {
    nuxtswagger?: Partial<NuxTSwaggerCliOptions> | Partial<NuxTSwaggerCliOptions>[]
  }
  interface PublicRuntimeConfig {
    nuxtswagger?: Partial<NuxTSwaggerOptions> | Partial<NuxTSwaggerOptions>[]
  }
}
