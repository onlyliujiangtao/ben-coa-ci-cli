import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { exec } from './uBase'

export function rm_dir (dir: string) {
  exec(`rm -rf ${dir}`)
}

export function rm_file (file: string) {
  exec(`rm -f ${file}`)
}

export function mv_dir (source: string, target: string) {
  exec(`mv ${source} ${target}`)
}

export function cp_files (files: string, target: string) {
  exec(`cp -r ${files} ${target}`)
}

export function mk_dir (dir: string) {
  mkdirSync(dir, { recursive: true })
}

export function is_exists (dir: string) {
  return existsSync(dir)
}

export function mk_empty_dir (dir: string) {
  rm_dir(dir)
  mk_dir(dir)
}

export function write (file: string, text: string) {
  writeFileSync(file, text)
}