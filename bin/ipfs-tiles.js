#!/usr/bin/env node

const { program } = require('commander')

function initAction () {
  if (program.debug) process.env.DEBUG = (process.env.DEBUG ? process.env.DEBUG + ',' : '') + 'ipfs-tiles'
  const debug = require('debug')('ipfs-tiles')
  debug('options', program.opts())
}

program
  .version(require('../package.json').version)
  .name('ipfs-tiles')
  .option('-d, --debug', 'output debugging info')
  .option('--ipfs <url>', 'URL to IPFS node', 'http://localhost:5001')
  .option('--id <value>', 'identifier of the tileset (read from mbtiles by default)')
  .option('--title <value>', 'name of the tileset (read from mbtiles by default, same as id if empty)')
  .option('--desc <value>', 'name of the tileset (read from mbtiles by default, same as id if empty)')
  .option('--domain <url>', 'domain to use in HTTP links to tiles. RECOMMENDED for updatable tileset with constant URLs')
  .option('--gateway <url>', 'public gateway to use in HTTP links to tiles, not used if domain is specified', 'https://ipfs.koumoul.net')

program.command('create <mbtiles>')
  .description('import all the content of a mbtiles in a new IPFS node')
  .action(async (mbtiles) => {
    initAction()
    await require('../lib').createMbtiles(mbtiles, program.opts())
  })

program.command('update <mbtiles>')
  .description('import all the content of a mbtiles in an already existing IPFS node')
  .action(async (mbtiles) => {
    initAction()
    await require('../lib').updateMbtiles(mbtiles, program.opts())
  })

program.command('delete <id>')
  .description('delete the key and unpin the data of an IPFS node containing some tiles')
  .action(async (id) => {
    initAction()
    await require('../lib').deleteMbtiles(id, program.opts())
  })

program.command('deploy')
  .description('deploy the app')
  .action(async () => {
    initAction()
    await require('../lib').deploy(program.opts())
  })

async function main () {
  await program.parseAsync(process.argv)
}

main()
  .then(() => process.exit())
  .catch(error => { console.error(error); process.exit(-1) })
