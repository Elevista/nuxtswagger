import { Spec } from './Spec'
import { TemplateCommon, TemplateOptions } from '../../TemplateCommon'

export default class Template extends TemplateCommon {
  protected spec:Spec
  constructor (spec: Spec, options: TemplateOptions) {
    super(spec, options)
    spec.definitions = this.fixKeys(spec.definitions)
    this.spec = spec
  }

  importTypes () {
    return this.importTypesBase(this.spec.definitions)
  }

  definitions () {
    return this.definitionsBase(this.spec.definitions)
  }
}
