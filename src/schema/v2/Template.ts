import { Response, Spec } from './Spec'
import { TemplateCommon, TemplateOptions } from '../../TemplateCommon'

export default class Template extends TemplateCommon {
  protected spec: Spec
  constructor (spec: Spec, options: TemplateOptions) {
    super(spec, options)
    spec.definitions = this.fixKeys(spec.definitions)
    this.spec = spec
  }

  get schemas () {
    return this.spec.definitions
  }

  getResponseType ({ schema }: Response): string {
    if (!schema) return 'any'
    return this.typeDeep(schema)
  }
}
