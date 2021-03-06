# NuxTSwagger
Nuxt-TS-Swagger plugin generator CLI

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=flat-square)](https://standardjs.com)  [![npm package](https://img.shields.io/npm/v/nuxtswagger.svg?maxAge=2592000&style=flat-square)](https://www.npmjs.com/package/nuxtswagger)

## Installation
```sh
npm i -D nuxtswagger
```

## Requirements
- [`Nuxt`](https://nuxtjs.org) base project
- [`@nuxtjs/axios`](https://axios.nuxtjs.org) module

## Basic Usage
in Nuxt project directory
```sh
nuxtswagger https://api.server.foo/swagger.json
```
in `nuxt.config.js`
```js
module.exports = {
  plugins: [
    '~/plugins/api'
  ]
}
```
in component
```js
export default {
  async asyncData ({ app: { $api } }) {
    return { foo: await $api.foo.get() }
  },
  data () { return { bar: undefined } },
  async mounted () { this.bar = await this.$api.bar.get() }
}
```

## Options
```sh
nuxtswagger argument1 --option1=value1 --option2=value2
```
	
| option | description | default | example |
| --- | --- | --- | --- |
| first argument | Swagger schema JSON path | (required) | `http://..` or `./foo/swagger.json`  |
| `src` | same as first argument | first argument | same as above  |
| `plugins-dir` | Nuxt plugins directory | `plugins` |  |
| `plugin-name` | Name for generated plugin | `api` |  |
| `inject` | Nuxt plugin inject key | `{plugin-name}` |  |
| `type-path` | Path for scheme type file | `{plugins-dir}/{plugin-name}/{types.ts}` | `./types/swagger.d.ts` |
| `base-path` | base path | `/v1` | `/v2` |

### Set options using `package.json`
```json
{
  "scripts": {
    "swagger": "nuxtswagger"
  },
  "nuxtswagger": {
    "src": "https://api.server.foo/swagger.json",
    "pluginName": "foo"
  }
}
```
and `npm run swagger` or `npx nuxtswagger`


## License
ISC License
Copyright (c) 2020, Elevista
