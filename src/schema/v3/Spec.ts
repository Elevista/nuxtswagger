/* eslint-disable no-use-before-define */
type PrimitiveTypes = 'string' | 'number' | 'integer' | 'boolean'
type TypeNames = PrimitiveTypes | 'array' | 'object'
export type ParameterPositions = 'query'| 'header'| 'path' | 'cookie'
export type Formats = 'date' | 'date-time' | 'password' | 'byte' | 'binary'
export enum MethodTypes{get='get', post='post', put='put', patch='patch', delete='delete', head='head', options='options'}
export interface Ref {
  description?: string
  $ref: string
}

export type TypeProto<T = string> = {
  type: TypeNames,
  title?: T
  example?: T
  default?: T
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

export type Types = (TypeEnum | TypeArray | TypeObject | TypeFormat | TypeBoolean | TypeString | TypeNumber | Ref)

export type Content = {
  [mediaType: string]: {
    schema: Types
  }
}

export interface Responses {
  [statusCode: number]: {
    description?: string
    content:Content
  }
}

export interface Method {
  description?: string
  operationId: string
  responses: Responses
  summary?: string
  parameters?: Array<ParameterTypes>
  requestBody?:{
    required?: boolean
    content:Content
  }
  tags: Array<string>
}

export type Methods = {
  [method in MethodTypes]: Method
}

export interface ParameterProto<T=string> extends TypeProto<T>{
  in: ParameterPositions
  name: string
  required?: true
  description?: string
}

export interface ParameterSchema extends ParameterProto{
  schema: Ref
}

export interface ParameterEnum extends ParameterProto {
  type: 'string'
  enum: Array<string>
}

export interface ParameterArray extends ParameterProto {
  type: 'array',
  items: Types
}

export interface ParameterObject extends ParameterProto {
  type: 'object',
  properties?: { [propertyName: string]: Types }
}

export interface ParameterFormat extends ParameterProto {
  type: 'string'
  format: Formats
}

export interface ParameterBoolean extends ParameterProto<boolean> {
  type: 'boolean'
}

export interface ParameterString extends ParameterProto {
  type: 'string'
}

export interface ParameterNumber extends ParameterProto<number> {
  type: ('number' | 'integer')
}

export type ParameterTypes = (ParameterEnum | ParameterArray | ParameterObject | ParameterFormat | ParameterBoolean | ParameterString | ParameterNumber | ParameterSchema)

export interface Schemas {
  [schema: string]: Types
}

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
