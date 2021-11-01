export const camelCase = (str: string) => str.replace(/[-_. ]+([a-zA-Z])/g, (_, $1) => $1.toUpperCase())
export const keys = <T> (o: T) => Object.keys(o) as Array<keyof T>
export const entries = <K extends string, T>(o: { [key in K]: T }): [K, T][] => Object.entries(o) as any
export const notNullish = <TValue>(value: TValue | null | undefined): value is TValue => (value ?? null) !== null
export type CodeTree = string | number | { [key in string]: CodeTree } | CodeTree[]
export const stringify = (obj: CodeTree, space = '  ') => {
  const deep = (node: CodeTree, depth = 0): string => {
    if (typeof node !== 'object') return `${node}`
    const [padEnd, indent] = [space.repeat(depth), space.repeat(++depth)]
    if (node instanceof Array) return `[\n${node.map(x => indent + deep(x, depth)).join(',\n')}\n${padEnd}]`
    return `{\n${
      Object.entries(node).map(([key, value]) => `${indent}${key}: ${deep(value, depth)}`).join(',\n')
    }\n${padEnd}}`
  }
  return deep(obj)
}
