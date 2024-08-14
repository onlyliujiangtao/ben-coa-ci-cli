import { Axios, axios } from 'coa-helper'
import { throw_error } from './uBase'

axios.defaults.proxy = false

async function request (config: Axios.AxiosRequestConfig) {
  const baseURL = process.env.COA_CI_HOST || process.env.CI_HOST || throw_error('缺少 CI HOST')
  const res = await axios({ baseURL, proxy: false, ...config })
  return res.data
}


export async function flow_version_new (name: string) {
  const res = await request({ method: 'GET', url: '/flow/version/new', params: { name } })
  return res.version as number || 0
}

export async function flow_cert_get (ns: string, id: string) {
  const token = process.env.COA_CI_TOKEN || process.env.CI_TOKEN || throw_error('缺少 CI TOKEN')
  const res = await request({ method: 'GET', url: '/flow/cert/get', params: { ns, id, token } })
  const data = res.data || throw_error(`证书 ${ns}: ${id} 不存在`)
  return Buffer.from(data, 'base64').toString()
}