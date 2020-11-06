const c = require('chalk')
const { fetch } = require('cross-fetch')
const fs = require('fs')
const p = require('path')
module.exports = async function (path) {
  const isRemote = /^[a-z]+?:\/\//.test(path)
  if (!isRemote) return JSON.parse(fs.readFileSync(p.resolve(path)).toString())
  console.log(c.cyan('fetching'), 'JSON from', c.underline(path))
  return fetch(path).then(res => {
    if (res.status >= 400) throw new Error('Fetch Error')
    return res.json()
  })
}
