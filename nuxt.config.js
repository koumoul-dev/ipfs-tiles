const fs = require('fs')
const colors = require('vuetify/es5/util/colors').default

const tileJsons = fs.readdirSync('public/static/tilejson')
  .map(f => ({ id: f.replace('.json', ''), body: require('./public/static/tilejson/' + f) }))

module.exports = {
  mode: 'spa',
  srcDir: 'public/',
  loading: { color: '#1e88e5' },
  plugins: [
    { src: '~plugins/filters' },
    { src: '~plugins/moment' }
  ],
  modules: ['@nuxtjs/axios'],
  buildModules: ['@nuxtjs/vuetify'],
  vuetify: {
    theme: {
      themes: {
        light: {
          primary: colors.lightBlue.base
        }
      }
    }
  },
  env: {
    tileJsons
  },
  head: {
    title: 'IPFS tiles',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'application', name: 'application-name', content: 'ipfs-tiles' },
      { hid: 'description', name: 'description', content: 'Experimental map tiles hosting over IPFS.' }
    ]
  }
}
