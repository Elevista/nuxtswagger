import { Options } from './index'
export type TemplateOptions = Options & { relTypePath: string }

const typeMatch = 'type integer = number'
export abstract class TemplateBase {
  protected readonly relTypePath:string
  protected readonly basePath:string
  protected readonly inject:string
  protected readonly className:string
  protected readonly skipHeader:boolean
  protected constructor ({ pluginName, basePath, inject, skipHeader, relTypePath }:TemplateOptions) {
    this.relTypePath = relTypePath
    this.basePath = basePath
    this.skipHeader = skipHeader
    this.inject = inject.replace(/^[^a-zA-Z]+/, '').replace(/^[A-Z]/, x => x.toLowerCase())
    this.className = pluginName.replace(/^[^a-zA-Z]+/, '').replace(/^[a-z]/, x => x.toUpperCase())
  }

  abstract plugin():string
  abstract definitions():string
  abstract importTypes():string

  definitionsTemplate ({ definitions }: { definitions: string }) {
    return `/* eslint-disable */\n${typeMatch}\n${definitions}\n`
  }

  pluginTemplate ({ properties }: { properties: string }) {
    return `
/* eslint-disable */
import { Plugin } from '@nuxt/types'
import { AxiosRequestConfig } from 'axios'
import { NuxtAxiosInstance } from '@nuxtjs/axios'
${this.importTypes()}
${typeMatch}

class ${this.className} {
  public $axios: NuxtAxiosInstance
  constructor ($axios: NuxtAxiosInstance) {
    this.$axios = $axios
  }

${properties}
}
declare module '@nuxt/types' {
  interface NuxtAppOptions { $${this.inject}: ${this.className} }
}
declare module 'vue/types/vue' {
  interface Vue { $${this.inject}: ${this.className} }
}
declare module 'vuex/types/index' {
  interface Store<S> { $${this.inject}: ${this.className} }
}

const plugin: Plugin = ({ $axios }, inject) => {
  inject('${this.inject}', new ${this.className}($axios))
}
export default plugin
`.trimStart()
  }
}
