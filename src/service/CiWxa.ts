import { axios } from 'coa-helper'
import { unlinkSync } from 'fs'
import cBot from '../app/cBot'
import { flow_cert_get, flow_version_new } from '../app/uApi'
import { echo, throw_error } from '../app/uBase'
import { write } from '../app/uFile'
import { parse_config } from '../app/uHelper'
import { yarn } from '../app/uTool'

const default_config = {
  name: '',
  alias: '',
  mode: '',
  run: '',
  refs: '',
  heads: '',
  major: '',
  release: '',
  bot: 'dev',
  wxa_id: '',
  wxa_root: 'miniprogram',
  env: 'v1',
  env_file: 'env.ts',
  template_hook: '',
  ver_bot: 1,
  ver_desc: '优化细节',
}

export class CiWxa {

  private readonly ref: string

  constructor (ref: string) {
    this.ref = ref || ''
  }

  async build () {

    // 获取信息
    const { now, wxa_root, env_file, env } = parse_config(this.ref, default_config)

    // 安装依赖
    yarn()

    // 清除文件
    await this.clean()

    // 构建npm
    await this.npm()

    // 设置环境
    write(`${wxa_root}/${env_file}`, `export default '${env}'`)
    write(`${wxa_root}/ext.json`, `{}`)

    // 编译ts文件
    yarn('build')

    // 上传代码
    await this.upload(now)

  }

  async npm () {
    const ci = await import('miniprogram-ci')
    const { wxa_root } = parse_config(this.ref, default_config)
    // 构建npm
    const npmPack = await ci.packNpmManually({
      packageJsonPath: 'package.json',
      miniprogramNpmDistDir: wxa_root,
    })
    console.log('NPM构建完成:\n%o', npmPack)
  }

  async clean () {
    const { wxa_root } = parse_config(this.ref, default_config)
    // 清除文件
    const files = require('glob').sync(`${wxa_root}/**/*.*(js|js.map)`) as string[]
    for (const file of files) {
      unlinkSync(file)
    }
    console.log('清除完成，删除了%s个无效文件', files.length)
  }

  async upload (now: number) {

    const ci = await import('miniprogram-ci')

    const { name, alias, heads, release, bot, wxa_root, ver_bot, wxa_id, ver_desc } = parse_config(this.ref, default_config)
    wxa_id || throw_error('缺少wxa_id配置')
    alias || throw_error('缺少alias配置')
    const version = heads === 'tags' ? `${alias}.${release}` : `${alias}.${release}.${await flow_version_new(name)}`

    // 清除ext信息环境
    write(`${wxa_root}/ext.json`, `{}`)

    // 写入key
    write(`wxa.${wxa_id}.key`, await flow_cert_get('wxa', wxa_id) || throw_error('缺少小程序key'))

    // 上传代码
    const result = await ci.upload({
      project: new ci.Project({
        appid: wxa_id,
        type: 'miniProgram',
        projectPath: '.',
        privateKeyPath: `wxa.${wxa_id}.key`,
        ignores: ['node_modules/**/*'],
      }),
      version,
      desc: ver_desc,
      setting: {
        es6: true,
        es7: true,
        minify: true,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true,
        autoPrefixWXSS: true,
        codeProtect: false,
      },
      robot: ver_bot as 0 || 0
    })
    console.log('代码上传完成:\n%o', result)

    // 结束编译发送通知
    const content = cBot.markdown.green(`${name} 构建成功`)
      .br().quote().gray('版本: ').text(version)
      .br().quote().gray('耗时: ').text(((Date.now() - now) / 1000).toFixed(2)).text(' 秒')
    await cBot.devops(bot).markdown(content)

    // 开始触发模版钩子
    await this.templateHook(version)

    return { name, version }
  }

  async templateHook (version: string) {
    // 获取变量
    const now = Date.now()
    const { name, bot, template_hook } = parse_config(this.ref, default_config)

    // 如果没有必要参数就不处理
    if (!template_hook) return

    echo(`开始触发模版钩子 ${template_hook} ${version}`)

    // 开始部署
    const response = await axios.get(template_hook, { params: { version } }).catch(() => ({ data: {} }))

    const success = response.data.code === 200

    // 发送通知
    const content = cBot.markdown
      .red(`${name} 发布`).red(success ? '成功' : '失败')
      .br().quote().gray('版本: ').text(version)
      .br().quote().gray('用时: ').text(((Date.now() - now) / 1000).toFixed(2)).text(' 秒')
    await cBot.devops(bot).markdown(content)

    echo(`发布结束 ${template_hook} ${version}`)
  }
}