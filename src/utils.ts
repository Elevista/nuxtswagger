export const camelCase = (str:string) => str.replace(/[-_ ]+([a-zA-Z])/g, (_, $1) => $1.toUpperCase())
