import { ExtensionsV1beta1Ingress, V1Deployment, V1Service } from '@kubernetes/client-node'
import * as url from 'url'
import { echo, throw_error } from '../app/uBase'
import { flow_cert_get } from './uApi'
import uHelper from './uHelper'
import _ = require('lodash')

function kubeCatch (e: any) {
  throw new Error(e.response.body.message || e.body.message || e.message || e.toString())
}

export default new class {

  async updateDeploy (data: { deployment: string, container: string, origin: string, branch: string, image: string }) {

    const { deployment, container, origin, branch, image } = data
    const { memory, cpu, sleep, port, secret } = this.parseContainer(container)
    const { run_env, cluster, namespace, dep_name, svc_name, ingress_name } = this.parseDeployment(deployment, branch)
    const { host, path, run_base } = this.parseOrigin(origin, branch)
    const { kube, AppsV1Api, CoreV1Api, ExtensionsV1beta1Api } = await this.parseKube(cluster)

    // const { body: dep_read } = await kube.makeApiClient(AppsV1Api).readNamespacedDeployment(dep_name, namespace).catch(e => e)
    const res = await kube.makeApiClient(AppsV1Api).readNamespacedDeployment(dep_name, namespace).catch(e => e)
    echo(`readNamespacedDeployment: ${res}`)

    if (res?.body?.metadata?.name) {
      const depPatch = this.getDeploymentPatch({ dep_name }, { image })
      await kube.makeApiClient(AppsV1Api).patchNamespacedDeployment(dep_name, namespace, depPatch, undefined, undefined, undefined, undefined, { headers: { 'content-type': 'application/strategic-merge-patch+json' } }).catch(kubeCatch)
    } else {
      const dep = this.getDeployment({ dep_name }, { run_env, run_base, image, port, sleep, memory, cpu, secret })
      const svc = this.getService({ dep_name, svc_name }, { port })
      const ingress = this.getIngress({ svc_name, ingress_name }, { host, path, port })
      await kube.makeApiClient(AppsV1Api).createNamespacedDeployment(namespace, dep).catch(kubeCatch)
      await kube.makeApiClient(CoreV1Api).createNamespacedService(namespace, svc).catch(kubeCatch)
      await kube.makeApiClient(ExtensionsV1beta1Api).createNamespacedIngress(namespace, ingress).catch(kubeCatch)
    }

  }

  async deleteDeploy (data: { deployment: string, branch: string }) {

    const { deployment, branch } = data

    const { cluster, namespace, dep_name, svc_name, ingress_name } = this.parseDeployment(deployment, branch)
    const { kube, AppsV1Api, CoreV1Api, ExtensionsV1beta1Api } = await this.parseKube(cluster)

    await kube.makeApiClient(AppsV1Api).deleteNamespacedDeployment(dep_name, namespace).catch(e => e)
    await kube.makeApiClient(CoreV1Api).deleteNamespacedService(svc_name, namespace).catch(e => e)
    await kube.makeApiClient(ExtensionsV1beta1Api).deleteNamespacedIngress(ingress_name, namespace).catch(e => e)
  }

  parseContainer (container: string) {
    const { port, sleep, cpu, memory, secret } = _.defaults(uHelper.parse(container), { port: '80', sleep: '15', cpu: '100m', memory: '128Mi', secret: '' })
    return { port: _.toInteger(port), sleep, cpu, memory, secret }
  }

  parseOrigin (origin: string, branch: string) {
    origin = origin.replace(/[*?]/, branch)
    const info = url.parse(origin)
    const host = info.hostname || ''
    const path = (info.pathname || '').replace(/\/+$/g, '')
    const protocol = info.protocol || ''
    return { protocol, host, path, run_base: path }
  }

  async parseKube (cluster: string = '') {
    const { KubeConfig, AppsV1Api, CoreV1Api, ExtensionsV1beta1Api } = await import('@kubernetes/client-node')
    const kube = new KubeConfig()
    const config = await flow_cert_get('k8s', cluster)
    kube.loadFromString(config)
    echo(`kube-config: ${config}`)
    return { cluster, kube, AppsV1Api, CoreV1Api, ExtensionsV1beta1Api }
  }

  parseDeployment (deployment: string, branch: string) {
    const [run_env, cluster, namespace, dep] = deployment.split(/[:.]/)
    run_env && cluster && namespace && dep || throw_error('deployment参数有误')

    const dep_name = dep.replace(/[*?]/, branch)
    const name = dep_name.replace('dep-', '')
    const svc_name = 'svc-' + name
    const ingress_name = 'ingress-' + name

    return { run_env, cluster, namespace, dep_name, svc_name, ingress_name }
  }

  getDeployment (names: { dep_name: string }, data: { run_env: string, run_base: string, image: string, port: number, sleep: string, cpu: string, memory: string, secret: string }) {
    const { run_env, run_base, image, port, sleep, cpu, memory, secret } = data
    const { dep_name } = names
    return <V1Deployment>{
      'apiVersion': 'apps/v1',
      'kind': 'Deployment',
      'metadata': { 'name': dep_name, 'labels': { 'app': dep_name } },
      'spec': {
        'replicas': 1,
        'selector': { 'matchLabels': { 'app': dep_name } },
        'template': {
          'metadata': { 'labels': { 'app': dep_name } },
          'spec': {
            'containers': [{
              'name': dep_name,
              'image': image,
              'imagePullPolicy': 'IfNotPresent',
              'env': [{ 'name': 'RUN_ENV', 'value': run_env }, { 'name': 'RUN_BASE', 'value': run_base }],
              'envFrom': [],
              'resources': { 'requests': { 'cpu': cpu, 'memory': memory } },
              'livenessProbe': { 'initialDelaySeconds': 3, 'periodSeconds': 10, 'timeoutSeconds': 1, 'successThreshold': 1, 'failureThreshold': 3, 'httpGet': { 'scheme': 'HTTP', 'path': '/health', 'port': port as any } },
              'readinessProbe': { 'initialDelaySeconds': 3, 'periodSeconds': 10, 'timeoutSeconds': 1, 'successThreshold': 1, 'failureThreshold': 3, 'httpGet': { 'scheme': 'HTTP', 'path': '/health', 'port': port as any } },
              'lifecycle': { 'preStop': { 'exec': { 'command': ['sleep', sleep] } } },
            }],
            'imagePullSecrets': secret ? [{ 'name': secret }] : [],
          }
        }
      }
    }
  }

  getDeploymentPatch (names: { dep_name: string }, data: { image: string }) {
    const { image } = data
    const { dep_name } = names
    return <V1Deployment>{
      'spec': {
        'template': {
          'spec': {
            'containers': [{
              'name': dep_name,
              'image': image,
            }]
          }
        }
      }
    }
  }

  getService (names: { dep_name: string, svc_name: string }, data: { port: number }) {
    const { port } = data
    const { dep_name, svc_name } = names
    return <V1Service>{
      'apiVersion': 'v1',
      'kind': 'Service',
      'metadata': { 'name': svc_name },
      'spec': { 'selector': { 'app': dep_name }, 'ports': [{ 'protocol': 'TCP', 'port': _.toInteger(port), 'targetPort': port as any }], 'type': 'ClusterIP' }
    }
  }

  getIngress (names: { svc_name: string, ingress_name: string, }, data: { host: string, path: string, port: number }) {
    const { host, path, port } = data
    const { svc_name, ingress_name } = names
    return <ExtensionsV1beta1Ingress>{
      'apiVersion': 'extensions/v1beta1',
      'kind': 'Ingress',
      'metadata': { 'name': ingress_name },
      'spec': { 'rules': [{ 'http': { 'paths': [{ 'path': path, 'backend': { 'serviceName': svc_name, 'servicePort': port as any } }] }, 'host': host }] }
    }
  }

}