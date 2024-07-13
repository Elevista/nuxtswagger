# NuxTSwagger

Nuxt-TS-Swagger plugin generator CLI

[![npm package](https://img.shields.io/npm/v/nuxtswagger.svg?maxAge=2592000&style=flat-square)](https://www.npmjs.com/package/nuxtswagger)
[![github stars](https://img.shields.io/github/stars/Elevista/nuxtswagger?style=social)](https://github.com/Elevista/nuxtswagger)

## Installation

```sh
npm i -D nuxtswagger
```

## Requirements

- [`Nuxt`](https://nuxt.com) base project

## Basic Usage

in Nuxt project directory

```sh
npx nuxtswagger https://api.server.foo/swagger.json
```

in script code

```js
import { api } from '~/lib/api'
const response = await api.foo.bar(1).post(requestBody) // Post /foo/{bar} 
api.foo.bar.get() // GET /foo/bar
```

## Options

options priority : command line > `nuxt.config` > `package.json`

```sh
nuxtswagger argument1 --option1 value1 --option2 value2
```

| option           | description                | default                                  | example                             |
|------------------|----------------------------|------------------------------------------|-------------------------------------|
| (first argument) | Swagger schema JSON path   | (required)                               | `http://..` or `./foo/swagger.json` |
| `src`            | same as first argument     | first argument                           | same as above                       |
| `plugins-dir`    | Nuxt plugins directory     | `plugins`                                |                                     |
| `plugin-name`    | Name for generated plugin  | `api`                                    |                                     |
| `export-name`    | Export name                | `{plugin-name}`                          | `''`(export default)                |
| `type-path`      | Path for scheme type file  | `{plugins-dir}/{plugin-name}/{types.ts}` | `./types/swagger.d.ts`              |

### Set options using `package.json`

```json
{
  "nuxtswagger": {
    "pluginName": "foo",
    "src": "https://api.server.foo/swagger.json"
  }
}
```

### Set options using `nuxt.config`

*v1.2+*

```js
export default defineNuxtConfig({
  nuxtswagger: [
    { pluginName: 'foo', src: 'https://api.server.foo/swagger.json' },
    { pluginName: 'bar', src: 'https://api.server.bar/swagger.json' },
  ],
  runtimeConfig: {
    public: {
      nuxtswagger: {
        pluginName: 'foo',
        // AxiosRequestConfig?
        axiosConfig: { baseURL: 'https://api-stage.server.foo' }
      },
    },
  },
})
```

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "types": ["nuxtswagger/types"]
  }
}
```

and `npm run swagger` or `npx nuxtswagger`

## License

ISC License
Copyright (c) 2020, Elevista
