export type methods = ('get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options')
type PrimitiveTypes = ('string' | 'number' | 'integer' | 'boolean')
type TypeNames = PrimitiveTypes | ('array' | 'object')
export type ParameterPositions = ('header' | 'body' | 'path' | 'query' | 'cookie')
export type Formats = ('date' | 'date-time' | 'password' | 'byte' | 'binary')


type TypeProto<T = string> = {
  type: TypeNames,
  description?: string
  example?: T
  default?: T
}

export interface TypeEnum extends TypeProto {
  type: 'string'
  enum: Array<string>
}

export interface TypeArray extends TypeProto {
  type: 'array',
  items: Type
}

export interface TypeObject extends TypeProto {
  type: 'object',
  properties?: { [propertyName: string]: Type }
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
  default?: string
}

export interface TypeNumber extends TypeProto<number> {
  type: ('number' | 'integer')
  minimum?: number
  maximum?: number
}

export interface Ref {
  description?: string
  $ref: string
}


export type Type = (TypeEnum | TypeArray | TypeObject | TypeFormat | TypeBoolean | TypeString | TypeNumber | Ref)

export interface Responses {
  [statusCode: number]: {
    description?: string
    schema: Type
  }
}

export type Path = {
  [method in methods]?: {
    description?: string
    operationId: string
    responses: Responses
    summary: string
    parameters?: Array<Parameter>
    tags: Array<string>
  }
}

type ParameterProto = {
  in: ParameterPositions
  name: string
  format?: Formats | string
  required?: true
  description?: string
}

export interface ParameterPrimitive extends ParameterProto {
  type: PrimitiveTypes
}

export interface ParameterSchema extends ParameterProto {
  schema: Type
}

export type Parameter = ParameterPrimitive | ParameterSchema

export interface Spec {
  swagger: '2.0'
  schemes: Array<('http' | 'https')>
  info: { title: string, version: string, description: string }
  definitions: { [definition: string]: Type }
  paths: { [path: string]: Path }

  [rest: string]: any
}
