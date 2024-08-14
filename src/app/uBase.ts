import { execSync } from 'child_process'
import { resolve } from 'path'

const cwd = process.cwd()

export function exec (cmd: string, cwd = '', pipe = false) {
  const stdio = pipe ? 'pipe' : 'inherit'
  return execSync(cmd, { encoding: 'utf8', cwd: get_cwd(cwd), stdio })
}

export function throw_error (message: string): never {
  throw new Error(message)
}

export function get_cwd (path = '') {
  return resolve(cwd, path)
}

export function get_package () {
  return require(resolve(__dirname, '..', 'package.json'))
}

export function echo (string: string) {
  console.log(string)
}