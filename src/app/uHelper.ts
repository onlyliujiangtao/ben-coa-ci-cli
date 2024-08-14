import { _ } from 'coa-helper'
import { get_cwd, throw_error } from '../app/uBase'


export function parse_config<T> (ref: string, default_config: T) {
  const config = require(get_cwd('ci.config')) || {}
  const name = config.name || throw_error('ci.config缺少name参数')
  const mode = config.mode || throw_error('ci.config缺少mode参数')
  const now = _.now()

  const [refs = 'refs', heads = 'heads', release = 'beta'] = (ref || 'refs').split('/')
  const major = release.split(/[.\/\-]/)[0]

  const config_refs = config[`${refs}`] || {}
  const config_heads = config[`${refs}/${heads}`] || {}
  const config_major = config[`${refs}/${heads}/${major}`] || {}

  const branch = heads === 'heads' ? _.kebabCase(release).replace('main', '') : ''
  const bot = config.bot || branch || 'main'

  const res = { now, name, mode, bot, refs, heads, branch, major, release }
  _.defaults(res, config_major, config_heads, config_refs, config)
  return _.defaults(res, default_config)
}

export default new class {

  timeout (ms: number = 0) {
    return new Promise<void>(resolve => {
      setTimeout(() => resolve(), ms)
    })
  }

  parse (str: string) {
    const res = {} as { [k: string]: string }
    str.split(/[&;]/).forEach(item => {
      const [k, v] = item.split(/[=:]/)
      res[k] = v
    })
    return res
  }
}