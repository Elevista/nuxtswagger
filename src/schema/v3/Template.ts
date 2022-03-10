import { TemplateCommon, TemplateOptions } from '../../TemplateCommon'
import { Spec, Response } from './Spec'
export default class Template extends TemplateCommon {
  protected spec: Spec
  constructor (spec: Spec, options: TemplateOptions) {
    super(spec, options)
    spec.components.schemas = this.fixKeys(spec.components.schemas)
    this.spec = spec
  }

  get schemas () {
    return this.spec.components.schemas
  }

  getResponseType ({ content }: Response): string {
    const schema = content?.['application/json']?.schema
    if (!schema) return 'any'
    return this.typeDeep(schema)
  }
}
