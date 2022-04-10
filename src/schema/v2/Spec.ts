/* eslint-disable no-use-before-define */
type PrimitiveTypes = 'string' | 'number' | 'integer' | 'boolean'
type TypeNames = PrimitiveTypes | 'array' | 'object' | 'file'
export type ParameterIn = 'header' | 'body' | 'path' | 'query' | 'cookie' | 'formData'
export type Formats = 'date' | 'date-time' | 'password' | 'byte' | 'binary'
export enum MethodTypes {get = 'get', post = 'post', put = 'put', patch = 'patch', delete = 'delete', head = 'head', options = 'options'}
export interface Ref {
  description?: string
  $ref: string
}

export type TypeProto<T = string> = {
  type: TypeNames,
  title?: T;
  example?: T
  default?: T
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

export interface TypeFile extends TypeProto {
  type: 'file'
  additionalProperties?: boolean | Types | {}
  properties?: { [propertyName: string]: Types }
  required?: Array<string>
}

export type TypeOf = { description?: string } & { allOf: Types[] }

export type Types = (TypeEnum | TypeArray | TypeObject | TypeFormat | TypeBoolean | TypeString | TypeNumber | TypeFile | TypeOf | Ref)

export interface Response {
  description?: string
  schema?: Types
  examples?: { [mimeType in string]: any }
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
export type ParameterFile = ParameterCommon & TypeFile
export type ParameterTypes = (ParameterEnum | ParameterArray | ParameterObject | ParameterFormat | ParameterBoolean | ParameterString | ParameterNumber | ParameterSchema | ParameterFile)

export interface Definitions {
  [definition: string]: Types
}

export interface Paths {
  [path: string]: Methods
}

export interface Spec {
  swagger: '2.0'
  schemes: Array<('http' | 'https')>
  info: { title: string, version: string, description: string }
  definitions: Definitions
  paths: Paths
}
