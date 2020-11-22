import { TemplateBase } from '../../TemplateBase'
import { Spec } from './Spec'

export default class Template extends TemplateBase {
  private readonly spec:Spec
  constructor (spec: Spec, { pluginName, basePath, inject, relTypePath }: { pluginName: string, basePath: string, inject: string, relTypePath: string }) {
    super({ pluginName, basePath, inject, relTypePath })
    this.spec = spec
  }

  importTypes (): string {
    return ''
  }

  definitions (): string {
    return ''
  }

  plugin (): string {
    return ''
  }
}
