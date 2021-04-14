import { Spec, ParameterPositions } from './Spec'
import { TemplateCommon, TemplateOptions } from '../../TemplateCommon'
export default class Template extends TemplateCommon {
  protected spec:Spec
  constructor (spec: Spec, options: TemplateOptions) {
    super(spec, options)
    spec.components.schemas = this.fixKeys(spec.components.schemas)
    this.spec = spec
  }

  importTypes () {
    return this.importTypesBase(this.spec.components.schemas)
  }

  definitions () {
    return this.definitionsBase(this.spec.components.schemas)
  }
}
