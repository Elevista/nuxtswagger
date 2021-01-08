/* eslint-disable no-use-before-define */
type PrimitiveTypes = 'string' | 'number' | 'integer' | 'boolean'
type TypeNames = PrimitiveTypes | 'array' | 'object'
export type ParameterPositions = 'header' | 'body' | 'path' | 'query' | 'cookie'
export type Formats = 'date' | 'date-time' | 'password' | 'byte' | 'binary'
export enum MethodTypes{get='get', post='post', put='put', patch='patch', delete='delete', head='head', options='options'}
export interface Ref {
  description?: string
  $ref: string
}

export type TypeProto<T = string> = {
  type: TypeNames,
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

export interface TypeObject extends TypeProto {
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

export interface Responses {
  [statusCode: number]: {
    description?: string
    schema: Types
  }
}

export interface Method {
  description?: string
  operationId: string
  responses: Responses
  summary?: string
  parameters?: Array<ParameterTypes>
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
