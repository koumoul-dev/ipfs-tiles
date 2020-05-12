const { promisify } = require('util')
const fs = require('fs-extra')
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

  // get or create a new key for an ipns
  // this will allow us to have a stable ipns link instead of a moving ipfs each time we add some tiles
  const keys = await ipfs.key.list()
  let key = keys.find(k => k.name === 'tiles-' + id)
  if (!key) {
    debug('create new key tiles-' + id)
    key = await ipfs.key.gen('tiles-' + id, { type: 'rsa', size: 2048 })
  }

  // get the root node (=directory) for the tiles, create it if not existing
  let currentId
  debug('resolve ipns to find current data', key.id)
  for await (const name of ipfs.name.resolve(key.id)) {
    currentId = name.replace('/ipfs/', '')
  }
  if (currentId) {
    try {
      debug('check that current data is accessible')
      await ipfs.object.get(currentId, { timeout: 1000 })
    } catch (err) {
      currentId = null
    }
  }
  if (!currentId) {
    debug('init new directory for data')
    currentId = await ipfs.object.new()
  }

  const addFile = async (name, content) => {
    debug('Write file', name)
    for await (const result of ipfs.add(content, { pin: false })) {
      const newId = await ipfs.object.patch.addLink(currentId, { name, ...result })
      if (newId.toString() !== currentId.toString()) {
        try {
          await ipfs.pin.rm(currentId)
        } catch (err) {
        // nothing to do, probably not prevously pinned
        }
        currentId = newId
        await ipfs.pin.add(currentId)
      }
    }
  }
  await addFile('info.json', JSON.stringify(info, null, 2))

  for await (const tilesPacket of mbtiles.createZXYStream()) {
    for (const tileKey of tilesPacket.toString().split('\n').map(t => t.trim()).filter(t => !!t)) {
      const tile = await getTile(tileKey)
      let data
      if (tile.headers['Content-Encoding'] === 'gzip') {
        data = await gunzip(tile.data)
      } else {
        data = tile.data
      }
      await addFile(`${tileKey.replace(/\//g, '-')}.${info.format}`, data)
    }
    debug('Run garbage collector')
    await ipfs.repo.gc()
  }
  ipfs.name.publish(currentId, { key: key.name })

  const tilePrefix = opts.domain || `${opts.gateway}/ipns/${key.id}`

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
