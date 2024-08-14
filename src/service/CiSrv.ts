import { axios } from 'coa-helper'
import cBot from '../app/cBot'
import { flow_version_new } from '../app/uApi'
import { echo } from '../app/uBase'
import { cp_files, mk_dir, mk_empty_dir, mv_dir, rm_file, write } from '../app/uFile'
import uHelper, { parse_config } from '../app/uHelper'
import uK8s from '../app/uK8s'
import { docker, tar_zcf, yarn, yarn_env } from '../app/uTool'

const default_config = {
  files: 'run static package.json yarn.lock',
  dist_file: 'dist.tar',
  version_file: 'static/version',
  health_file: 'static/health',
  build_dir: 'build-dist/',
  cache_dir: 'node_modules/.build_cache/',
  registry: 'registry.aliyuncs.com/ix',
  node_modules: 'node_modules',
  deployment: '',
  origin: '',
  home: '*',
  protect: true,
  probe: '*version',
  container: 'cpu=100m;memory=128Mi;sleep=15;expose=80',
}

export class CiSrv {

  private readonly ref: string

  constructor (ref: string) {
    this.ref = ref || ''
  }

  async build () {

    // 获取变量
    const { now, name, heads, branch, release, files, dist_file, health_file, version_file, build_dir, cache_dir, node_modules, registry, origin, bot } = parse_config(this.ref, default_config)
    const { path } = uK8s.parseOrigin(origin, branch)
    const have_package_json = files.includes('package.json')
    const version = heads === 'tags' ? release : `${release}.${await flow_version_new(name)}`
    const image = `${registry}/${name}:${version}`

    // 生成版本文件
    echo(`version: ${version}`)
    write(version_file, version)
    write(health_file, '')

    echo(`开始构建...`)

    // 开始构建
    yarn()
    yarn_env(`CI_BRANCH=${branch} CI_ORIGIN_PATH=${path}`, 'build', '')

    // 压缩构建物
    mk_empty_dir(build_dir)
    cp_files(files, build_dir)
    if (have_package_json) {
      mk_dir(cache_dir + node_modules)
      mv_dir(cache_dir + node_modules, build_dir)
      yarn('--prod', build_dir)
    }
    tar_zcf(build_dir, dist_file)

    echo(`开始打包上传...`)

    // Docker构建和推送
    docker(`build -t "${image}" .`)
    docker(`push "${image}"`)
    echo(`${image}`)

    // 储存缓存文件
    have_package_json && mv_dir(build_dir + node_modules, cache_dir + node_modules)

    // 清除临时文件
    yarn('clean')
    rm_file(dist_file)

    // 结束编译开始部署
    const content = cBot.markdown.green(`${name} 构建成功`)
      .br().quote().gray('版本: ').text(version)
      .br().quote().gray('镜像: ').text(image)
      .br().quote().gray('用时: ').text(((Date.now() - now) / 1000).toFixed(2)).text(' 秒')
    cBot.devops(bot || branch || 'main').markdown(content).then().catch()

    await this.deploy(version, image)

  }

  async deploy (version: string, image: string) {

    // 获取变量
    const { now, name, bot, deployment, origin, home, container, probe, branch } = parse_config(this.ref, default_config)

    // 如果没有必要参数就不处理
    if (!(origin && deployment)) return

    echo(`开始部署 ${deployment} ${image}`)

    await uK8s.updateDeploy({ deployment, container, image, origin, branch })

    // 开始校验是否部署成功
    const originUrl = origin.replace(/[*?]/, branch)
    const probeUrl = probe.replace(/[*?]/, originUrl)
    const homeUrl = home.replace(/[*?]/, originUrl)

    echo(`探针路径: ${probeUrl} 预期: ${version.trim()}`)

    let i = 0, success = false
    while (!success && i < 50) {
      i++
      await uHelper.timeout(2000)
      const response = await axios.get(probeUrl, { responseType: 'arraybuffer' }).catch(() => ({ data: '' }))
      const result = Buffer.from(response.data).toString()
      success = result.includes(version)
      echo(`第${i}次检测: ${success ? '成功' : '失败'} ${result.trim().slice(0, 100)}`)
    }

    // 发送通知
    const content = cBot.markdown
      .red(`${name} 发布`).red(success ? '成功' : '失败')
      .br().quote().gray('版本: ').text(version)
      .br().quote().gray('入口: ').link(homeUrl, homeUrl)
      .br().quote().gray('用时: ').text(((Date.now() - now) / 1000).toFixed(2)).text(' 秒')
    cBot.devops(bot).markdown(content).then().catch()

    echo(`发布结束 ${deployment} ${originUrl}`)

  }

  async clean () {

    // 获取变量
    const { deployment, protect, branch } = parse_config(this.ref, default_config)

    // 如果不满足条件不处理
    if (protect) return
    if (!deployment) return
    if (['main', 'master', 'beta', ''].includes(branch)) return

    await uK8s.deleteDeploy({ deployment, branch })

    echo(`清理发布结束 ${deployment} ${branch}]`)

  }
}