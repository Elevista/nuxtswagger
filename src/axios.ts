import { toValidName, traversePaths, variableBoundary } from 'tswagger'
import { Schema } from 'tswagger/dist/spec/schema'
import { Paths as PathV2 } from 'tswagger/dist/spec/v2'
import { Paths as PathV3 } from 'tswagger/dist/spec/v3'
import { multipart, multipartCode } from 'tswagger/dist/gen/template'
import { generateApiMethods } from 'tswagger/dist/gen/axios'
import { promiseWrapper, exportCode } from 'tswagger/dist/gen/axiosTemplate'
import { AxiosConfig } from '.'
type Paths = PathV2 | PathV3

export const genAxiosCode = (paths: Paths, relTypePath: string, components: Record<string, Schema> = {}, options: {axiosConfig?: AxiosConfig, pluginName: string, exportName: string}) => {
  const { pluginName, exportName } = options
  const obj = traversePaths(paths, generateApiMethods)
  const refTypes = Object.keys(components).map(toValidName).filter(x => variableBoundary(x).test(obj))
  const axiosConfig = options.axiosConfig && `[useRuntimeConfig().public.nuxtswagger].flat().find(x => x?.pluginName === '${pluginName}')?.axiosConfig || {}`
  return `/* eslint-disable */
import Axios, { AxiosStatic, AxiosResponse, AxiosError } from 'axios'
import { ${refTypes.join(', ')} } from '${relTypePath}'
${promiseWrapper}
export const $axiosConfig: Required<Parameters<AxiosStatic['create']>>[0] = ${axiosConfig || '{}'}
${exportCode(exportName, obj)}
${variableBoundary(multipart).test(obj) ? multipartCode : ''}
`
}
