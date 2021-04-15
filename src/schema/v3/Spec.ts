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
  additionalProperties?: Boolean|Types|{}
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

export interface Response {
  description?: string
  content:Content
}

export interface Responses {
  [statusCode: number]: Response
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

export type ParameterCommon = {
  in: ParameterPositions
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
