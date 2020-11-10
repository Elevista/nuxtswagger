import * as c from 'chalk'
import { fetch } from 'cross-fetch'
import { Spec } from './spec/OpenAPI2'
const fs = require('fs')
const p = require('path')
export default async function (path:string):Promise<Spec> {
  const isRemote = /^[a-z]+?:\/\//.test(path)
  if (!isRemote) return JSON.parse(fs.readFileSync(p.resolve(path)).toString())
  console.log(c.cyan('fetching'), 'JSON from', c.underline(path))
  return fetch(path).then(res => {
    if (res.status >= 400) throw new Error('Fetch Error')
    return res.json()
  })
}
