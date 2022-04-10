/* eslint-disable no-use-before-define */
type PrimitiveTypes = 'string' | 'number' | 'integer' | 'boolean'
type TypeNames = PrimitiveTypes | 'array' | 'object' | 'of'
export type ParameterIn = 'query'| 'header'| 'path' | 'cookie'
export type Formats = 'date' | 'date-time' | 'password' | 'byte' | 'binary'
export enum MethodTypes {get = 'get', post = 'post', put = 'put', patch = 'patch', delete = 'delete', head = 'head', options = 'options'}
export interface Ref {
  description?: string
  $ref: string
}

export type TypeProto<T = string> = {
  type: TypeNames,
  title?: T
  example?: T
  default?: T
  nullable?: boolean
  description?: string
}

export interface TypeEnum extends TypeProto {
  type: 'string'
  enum: Array<string>
}

export interface TypeArray extends TypeProto {
  type: 'array',
  items: Types
}

export interface TypeObject extends TypeProto<object> {
  type: 'object',
  additionalProperties?: boolean | Types | {}
  properties?: { [propertyName: string]: Types }
  required?: Array<string>
}

export interface TypeFormat extends TypeProto {
  type: 'string'
  format: Formats
}

export interface TypeBoolean extends TypeProto<boolean> {
  type: 'boolean'
}

export interface TypeString extends TypeProto {
  type: 'string'
}

export interface TypeNumber extends TypeProto<number> {
  type: ('number' | 'integer')
  minimum?: number
  maximum?: number
}

export type TypeOf = { description?: string } & ({ allOf: Types[] } | { oneOf: Types[] })

export type Types = (TypeEnum | TypeArray | TypeObject | TypeFormat | TypeBoolean | TypeString | TypeNumber | TypeOf | Ref)

export type Example = {
  summary?: string
  description?: string
  value?: any
  externalValue?: string // A URL that points to the literal example.
}

export type Content = {
  [mediaType: string]: {
    schema: Types
    examples?: { [param in string]?: Example }
  }
}

export interface Response {
  description?: string
  content?: Content
}

export type Responses = {
  [type in string]?: Response
}

export interface Method {
  operationId: string
  responses: Responses
  summary?: string
  description?: string
  parameters?: Array<ParameterTypes>
  requestBody?: {
    description?: string
    required?: boolean
    content: Content
  }
  tags: Array<string>
  deprecated?: boolean
}

export type Methods = {
  [method in MethodTypes]?: Method
}

export type ParameterCommon = {
  in: ParameterIn
  name: string
  required?: true
  description?: string
}

export type ParameterSchema = ParameterCommon & { schema: Ref }
export type ParameterEnum = ParameterCommon & TypeEnum
export type ParameterArray = ParameterCommon & TypeArray
export type ParameterObject = ParameterCommon & TypeObject
export type ParameterFormat = ParameterCommon & TypeFormat
export type ParameterBoolean = ParameterCommon & TypeBoolean
export type ParameterString = ParameterCommon & TypeString
export type ParameterNumber = ParameterCommon & TypeNumber
export type ParameterTypes = (ParameterEnum | ParameterArray | ParameterObject | ParameterFormat | ParameterBoolean | ParameterString | ParameterNumber | ParameterSchema)

export type Schemas = { [schema: string]: Types }

export interface Paths {
  [path: string]: Methods
}

export interface Spec {
  openapi: '3.0.0'
  info: { title: string, version: string, description: string }
  components: {
    schemas: Schemas
  }
  paths: Paths
}
