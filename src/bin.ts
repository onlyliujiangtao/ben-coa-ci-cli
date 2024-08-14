#!/usr/bin/env node

import { program } from 'commander'
import { CiFlow } from './service/CiFlow'
import { CiWxa } from './service/CiWxa'

program.command('clean [ref]').action(ref => new CiFlow(ref).clean())
program.command('build [ref]').action(ref => new CiFlow(ref).build())
program.command('release [ref]').action(ref => new CiFlow(ref).release())
program.command('wxa-clean [ref]').action(ref => new CiWxa(ref).clean())
program.command('wxa-npm [ref]').action(ref => new CiWxa(ref).npm())

program.parse(process.argv)

process.on('unhandledRejection', (err) => {
  console.error(err)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error(err)
  process.exit(1)
})
