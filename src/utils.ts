export const camelCase = (str: string) => str.replace(/[-_. ]+([a-zA-Z])/g, (_, $1) => $1.toUpperCase())
export const keys = <T> (o: T) => Object.keys(o) as Array<keyof T>
export const entries = <K extends string, T>(o: { [key in K]: T }): [K, T][] => Object.entries(o) as any
export const notNullish = <TValue>(value: TValue | null | undefined): value is TValue => (value ?? null) !== null
export type CodeTree = string | number | Function | { [key in string]: CodeTree } | CodeTree[]
export const stringWrap: { <O>(obj: O): O } = (obj: any) => {
  if (typeof obj === 'string') return `'${obj}'`
  if (obj instanceof Array) return obj.map(stringWrap)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, stringWrap(value)]))
  return obj
}
export const stringify = (obj: any, space = '  ', keepString = false) => {
  if (keepString) obj = stringWrap(obj)
  const deep = (node: CodeTree, depth = 0): string => {
    const [padEnd, indent] = [space.repeat(depth), space.repeat(++depth)]
    if (typeof node !== 'object') {
      const str = `${node}`
      const minIndent = str.match(/^\s+(\B|\b)/gm)?.sort().shift()
      return minIndent
        ? str.replace(new RegExp(`^${minIndent}`, 'gm'), padEnd)
        : str
    }
    if (node instanceof Array) return `[\n${node.map(x => indent + deep(x, depth)).join(',\n')}\n${padEnd}]`
    return `{\n${
      Object.entries(node).map(([key, value]) =>
          typeof value === 'function' ? deep(value, depth) : `${key}: ${deep(value, depth)}`,
      ).map(x => indent + x).join(',\n')
    }\n${padEnd}}`
  }
  return deep(obj)
}
