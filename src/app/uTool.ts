import { exec } from './uBase'

export function ci (cmd: string = '', cwd = '') {
  return exec(`mm-coa-ci ${cmd}`, cwd)
}

export function yarn (cmd: string = '', cwd = '') {
  return exec(`yarn ${cmd}`, cwd)
}

export function yarn_env (env: string, cmd: string = '', cwd = '') {
  return exec(`${env} yarn ${cmd}`, cwd)
}

export function docker (cmd: string) {
  return exec(`docker ${cmd}`)
}

export function git (cmd: string, cwd: string = '') {
  return exec(`git ${cmd}`, cwd)
}

export function tar_zcf (files: string, dist: string) {
  exec(`tar -zcf ${dist} -C ${files} .`)
}