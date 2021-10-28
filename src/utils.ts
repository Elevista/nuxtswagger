export const camelCase = (str:string) => str.replace(/[-_. ]+([a-zA-Z])/g, (_, $1) => $1.toUpperCase())
export const keys = <T> (o: T) => Object.keys(o) as Array<keyof T>
export const entries = <K extends string, T>(o: { [key in K]: T }): [K, T][] => Object.entries(o) as any
