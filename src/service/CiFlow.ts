import cBot from '../app/cBot'
import { throw_error } from '../app/uBase'
import { parse_config } from '../app/uHelper'
import { CiSrv } from './CiSrv'
import { CiWxa } from './CiWxa'


export class CiFlow {

  private readonly ref: string

  constructor (ref: string) {
    this.ref = ref || ''
  }

  async build () {

    const { mode, name, bot } = parse_config(this.ref, {})

    try {
      switch (mode) {
        case 'srv':
          await new CiSrv(this.ref).build()
          break
        case 'wxa':
          await new CiWxa(this.ref).build()
          break
        default:
          throw_error(`构建模式${mode}有误`)
      }
    } catch (e) {
      const content = cBot.markdown.green(`${name} 构建失败`).br().quote().gray('消息: ').text(`${this.ref} ${e.toString()}`)
      cBot.attchGithubRunsLink(content)
      await cBot.devops(bot).markdown(content)
      throw e
    }
  }

  async release () {

  }

  async clean () {

    const config = parse_config(this.ref, {})

    try {
      switch (config.mode) {
        case 'srv':
          await new CiSrv(this.ref).clean()
          break
        case 'wxa':
          break
        default:
          throw_error(`清理模式${config.mode}有误`)
      }
    } catch (e) {
      const { name, bot } = config
      const content = cBot.markdown.green(`${name} 清理失败`).br().quote().gray('消息: ').text(`${this.ref} ${e.toString()}`)
      cBot.attchGithubRunsLink(content)
      await cBot.devops(bot).markdown(content)
      throw e
    }
  }

}