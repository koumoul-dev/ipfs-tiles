const { promisify } = require('util')
const fs = require('fs').promises
const ipfsClient = require('ipfs-http-client')
const MBTiles = require('@mapbox/mbtiles')
const debug = require('debug')('ipfs-tiles')
const gunzip = promisify(require('zlib').gunzip)
const mbtilesPromise = (mbtilesPath) => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-new
    new MBTiles(mbtilesPath + '?mode=ro', (err, mbtiles) => {
      if (err) return reject(err)
      resolve(mbtiles)
    })
  })
}

exports.addMbtiles = async (mbtilesPath, opts) => {
  const ipfs = ipfsClient(opts.ipfs)
  const mbtiles = await mbtilesPromise(mbtilesPath)
  mbtiles.getInfo = promisify(mbtiles.getInfo)
  const getTile = (tileKey) => {
    return new Promise((resolve, reject) => {
      mbtiles.getTile(...tileKey.split('/'), (err, data, headers) => {
        if (err) return reject(err)
        resolve({ data, headers })
      })
    })
  }
  const info = await mbtiles.getInfo()
  debug('info', info)
  if (info.scheme && info.scheme !== 'xyz') throw new Error(`Only xyz schema is supported, found ${info.scheme}`)
  const id = opts.id || info.id
  const dir = `/tiles-${id}`
  // TODO evaluate performance difference between a large ipfs.add and many ipfs.files.write
  // also evaluate if creating a more nested directory structure would be a drag
  await ipfs.files.mkdir(dir, { parents: true })
  await ipfs.files.write(dir + '/info.json', JSON.stringify(info, null, 2), { create: true })
  for await (const tilesPacket of mbtiles.createZXYStream()) {
    for (const tileKey of tilesPacket.toString().split('\n').map(t => t.trim()).filter(t => !!t)) {
      debug('Write tile', tileKey)
      const tile = await getTile(tileKey)
      let data
      if (tile.headers['Content-Encoding'] === 'gzip') {
        data = await gunzip(tile.data)
      } else {
        data = tile.data
      }
      await ipfs.files.write(`${dir}/${tileKey.replace(/\//g, '-')}.${info.format}`, data, { create: true })
    }
  }
  const dirStats = await ipfs.files.stat(dir)
  const tilePrefix = opts.domain || `${opts.gateway}/ipfs/${dirStats.cid.toString()}`

  const tileJson = {
    tilejson: '3.0.0',
    name: opts.title || info.name || id,
    description: opts.desc || info.description || '',
    version: opts.version || info.version || '',
    attribution: opts.attribution || info.attribution || '',
    scheme: 'xyz',
    tiles: [`${tilePrefix}/{z}-{x}-{y}.${info.format}`],
    minzoom: info.minzoom,
    maxzoom: info.maxzoom,
    bounds: info.bounds,
    center: info.center,
    vector_layers: info.vector_layers || []
  }

  debug('tileJson result', tileJson)
  const tileJsonPath = `public/static/tilejson/${id}.json`
  await fs.writeFile(tileJsonPath, JSON.stringify(tileJson, null, 2))
  console.log(`tilejson written in ${tileJsonPath}`)
}

exports.deploy = async (opts) => {
  // same as running "nuxt generate"
  const { Nuxt, Builder, Generator } = require('nuxt')
  const nuxtConfig = require('../nuxt.config.js')
  nuxtConfig.dev = false
  const nuxt = new Nuxt(nuxtConfig)
  const generator = new Generator(nuxt, new Builder(nuxt))
  await generator.generate()

  // add all files to ipfs
  const ipfs = ipfsClient(opts.ipfs)
  let result
  for await (result of ipfs.add(ipfsClient.globSource('./dist', { recursive: true }))) {
    debug('added file', result)
  }
  await ipfs.pin.add(result.cid)
  console.log('hash of new pinned directory', result.cid)
}
