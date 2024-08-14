import { WxWorkBin, WxWorkBotService, WxWorkMarkdown } from 'coa-wx-work'

const keys = {
  'devops-default': '9bf2bef9-b5c8-49e4-a516-48dd81cb7474',
  'devops-alpha': '16efe685-b2cb-4a7c-a048-d01df020356a',
  'devops-beta': 'de07c853-3102-43cd-b503-10f224994e76',
  'devops-main': '45c44a56-9b44-4f9a-9517-1c01edc53afd',
}

const isCI = process.env.CI || ''

const bin = new WxWorkBin()

export default new class {

  get markdown () {
    return new WxWorkMarkdown()
  }

  devops (bot: string) {
    const name = 'devops-' + bot.split('-')[0]
    const key = (keys as any)[isCI ? name : ''] || keys['devops-default']
    return new WxWorkBotService(bin, key)
  }

  attchGithubRunsLink (markdown: WxWorkMarkdown) {
    const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env
    if (GITHUB_REPOSITORY && GITHUB_REPOSITORY && GITHUB_RUN_ID)
      markdown.br().quote().gray('日志: ').link(`RUNS-${GITHUB_RUN_ID}`, `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`)
  }

}