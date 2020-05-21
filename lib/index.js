const { promisify } = require('util')
const pipe = require('multipipe')
const { Transform } = require('stream')
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
      mbtiles.getInfo = promisify(mbtiles.getInfo)
      resolve(mbtiles)
    })
  })
}

const getTile = (mbtiles, tileKey) => {
  return new Promise((resolve, reject) => {
    mbtiles.getTile(...tileKey.split('/'), (err, data, headers) => {
      if (err) return reject(err)
      resolve({ data, headers })
    })
  })
}

// piped with a mbtiles.createZXYStream and emits a stream of extracted tiles
const getTilesStream = (mbtiles, info) => {
  let first = true
  return pipe(
    mbtiles.createZXYStream(),
    new Transform({
      objectMode: true,
      async transform(tilesPacket, encoding, callback) {
        try {
          if (first) {
            this.push({ path: 'info.json', content: JSON.stringify(info, null, 2) })
            first = false
          }
          for (const tileKey of tilesPacket.toString().split('\n').map(t => t.trim()).filter(t => !!t)) {
            const tile = await getTile(mbtiles, tileKey)
            let data
            if (tile.headers['Content-Encoding'] === 'gzip') {
              data = await gunzip(tile.data)
            } else {
              data = tile.data
            }
            // const fileObject = { path: `${tileKey.replace(/\//g, '-')}.${info.format}`, content: data }
            const fileObject = { path: `${tileKey}.${info.format}`, content: data }
            this.push(fileObject)
          }
        } catch (err) {
          return callback(err)
        }
        callback()
      }
    })
  )
}

// Create a new directory of tiles based on a mbtiles file
exports.createMbtiles = async (mbtilesPath, opts) => {
  const ipfs = ipfsClient(opts.ipfs)
  const mbtiles = await mbtilesPromise(mbtilesPath)
  const info = await mbtiles.getInfo()
  debug('info', info)
  if (info.scheme && info.scheme !== 'xyz') throw new Error(`Only xyz schema is supported, found ${info.scheme}`)
  const id = opts.id || info.id

  let key = (await ipfs.key.list()).find(k => k.name === 'tiles-' + id)
  let currentId
  if (key) {
    debug('get the existing directory for the tiles')
    try {
      for await (const name of ipfs.name.resolve(key.id)) {
        currentId = currentId || name.replace('/ipfs/', '')
      }
    } catch (err) {
      debug(err.message)
    }
  } else {
    debug('create new key tiles-' + id)
    key = await ipfs.key.gen('tiles-' + id, { type: 'rsa', size: 2048 })
  }
  debug('extract mbtiles into new node')
  let dirNode
  const tileStream = getTilesStream(mbtiles, info)
  tileStream.on('error', err => console.error(err))
  for await (const node of ipfs.add(tileStream, { wrapWithDirectory: true })) {
    dirNode = node
    debug('added node', node.path)
  }

  const newId = dirNode.cid.toString()
  if (currentId && currentId !== newId) {
    debug('unpin previous directory', currentId)
    console.log(`ID of previous version was "${currentId}", remove when transition to new IPFS is over.`)
  }
  if (currentId !== newId) {
    debug(`publish new directory /ipfs/${newId} under /ipns/${key.id}`)
    await ipfs.name.publish(newId, { key: key.name })
  }

  // IPNS seems to add too much latency
  // const tilePrefix = opts.domain || `${opts.gateway}/ipns/${key.id}`
  const tilePrefix = opts.domain || `${opts.gateway}/ipfs/${newId}`
  const tileJson = {
    tilejson: '3.0.0',
    name: opts.title || info.name || id,
    description: opts.desc || info.description || '',
    version: opts.version || info.version || '',
    attribution: opts.attribution || info.attribution || '',
    scheme: 'xyz',
    // tiles: [`${tilePrefix}/{z}-{x}-{y}.${info.format}`],
    tiles: [`${tilePrefix}/{z}/{x}/{y}.${info.format}`],
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

// Merge info from a diff mbtiles inside an existing tileset
exports.updateMbtiles = async (mbtilesPath, opts) => {
  const ipfs = ipfsClient(opts.ipfs)
  const mbtiles = await mbtilesPromise(mbtilesPath)
  const info = await mbtiles.getInfo()
  debug('info', info)
  if (info.scheme && info.scheme !== 'xyz') throw new Error(`Only xyz schema is supported, found ${info.scheme}`)
  const id = opts.id || info.id

  // get or create a new key for an ipns
  // this will allow us to have a stable ipns link instead of a moving ipfs each time we add some tiles
  const key = (await ipfs.key.list()).find(k => k.name === 'tiles-' + id)
  if (!key) throw new Error(`No key tiles-${id} found. Did you use the "create" command ?`)

  // get the existing root node (=directory) for the tiles
  let previousId
  for await (const name of ipfs.name.resolve(key.id)) {
    previousId = previousId || name.replace('/ipfs/', '')
  }

  if (previousId) {
    debug('check that current data is accessible')
    await ipfs.object.get(previousId, { timeout: 1000 })
  }

  let currentId = previousId
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

  let i = 0
  for await (const tile of getTilesStream(mbtiles, info)) {
    await addFile(tile.path, tile.content)
    i++
    if (i % 1000 === 0) {
      debug('Run garbage collector')
      for await (const res of ipfs.repo.gc()) {
        debug('garbage collected', res)
      }
    }
  }

  if (currentId.toString() !== previousId.toString()) {
    debug(`publish new directory /ipfs/${currentId.toString()} under /ipns/${key.id}`)
    await ipfs.name.publish(currentId.toString(), { key: key.name })
  }
  console.log(`published /ipns/${key.id}`)
}

// delete key and unpin referenced node
exports.deleteMbtiles = async (id, opts) => {
  const ipfs = ipfsClient(opts.ipfs)

  // get or create a new key for an ipns
  // this will allow us to have a stable ipns link instead of a moving ipfs each time we add some tiles
  const key = (await ipfs.key.list()).find(k => k.name === 'tiles-' + id)
  if (!key) throw new Error(`No key tiles-${id} found. Did you use the "create" command ?`)

  // get the existing root node (=directory) for the tiles
  let currentId
  try {
    for await (const name of ipfs.name.resolve(key.id)) {
      currentId = currentId || name.replace('/ipfs/', '')
    }
  } catch (err) {
    debug(err.message)
  }
  debug('delete key tiles-' + id)
  await ipfs.key.rm('tiles-' + id)
  if (currentId) {
    debug('unpin', currentId)
    await ipfs.pin.rm(currentId)
  }
}

exports.deploy = async (opts) => {
  // same as running "nuxt generate"
  const { Nuxt, Builder, Generator } = require('nuxt')
  const nuxtConfig = require('../nuxt.config.js')
  nuxtConfig.dev = false
  const nuxt = new Nuxt(nuxtConfig)
  const generator = new Generator(nuxt, new Builder(nuxt))
  await generator.generate()

  const ipfs = ipfsClient(opts.ipfs)
  let key = (await ipfs.key.list()).find(k => k.name === 'ipfs-tiles')
  let previousId
  if (!key) {
    key = await ipfs.key.gen('ipfs-tiles', { type: 'rsa', size: 2048 })
  } else {
    for await (const name of ipfs.name.resolve(key.id)) {
      previousId = name.replace('/ipfs/', '')
    }
  }

  if (previousId) debug('merge over existing directory', previousId)

  const concatenatedAsyncIterable = {
    [Symbol.asyncIterator]: async function * () {
      const paths = []
      for await (const file of ipfsClient.globSource('./dist/', { recursive: true })) {
        const path = file.path.replace('/dist', '')
        if (file.content) {
          debug('add file', path)
          paths.push(path)
          yield { path, content: file.content }
        }
      }
      if (previousId) {
        for await (const file of ipfs.get(previousId)) {
          const path = file.path.replace(previousId, '')
          if (file.content) {
            if (!path || paths.includes(path)) {
              for await (const buff of file.content) {} // drain
            } else {
              debug('keep old file', path)
              yield { path, content: file.content }
            }
          }
        }
      }
    }
  }

  // add all files to ipfs
  let result
  for await (result of ipfs.add(concatenatedAsyncIterable, { wrapWithDirectory: true })) {
    // debug('added file', result)
  }
  const newId = result.cid.toString()
  debug('new ipfs address', newId)

  console.log(`IPFS (faster) /ipfs/${newId}`)
  console.log(`IPNS (more stable) /ipns/${key.id}`)
  if (previousId !== newId) {
    if (previousId) console.log(`ID of previous version was "${previousId}", unpin when transition to new IPFS is over.`)
    await ipfs.pin.add(newId)
    await ipfs.name.publish(newId, { key: key.name })
  }
}
