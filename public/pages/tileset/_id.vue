<template>
  <v-container style="position: relative">
    <h1 class="display-1">
      <v-btn icon to="/" color="primary">
        <v-icon>mdi-home</v-icon>
      </v-btn>
      Tileset {{ tileJson.body.name }}
    </h1>
    <h2 class="title my-2">
      Inspect
    </h2>
    <v-card tile>
      <div id="map" />
    </v-card>
    <h2 class="title my-2">
      Details
    </h2>
    <p>The following JSON content follows the <a href="https://github.com/mapbox/tilejson-spec/tree/3.0/3.0.0">TileJSON specification</a>.</p>
    <v-btn icon absolute :href="`./tilejson/${tileJson.id}.json`" download right color="primary">
      <v-icon>mdi-download</v-icon>
    </v-btn>
    <pre>
{{ JSON.stringify(tileJson.body, null, 2) }}
  </pre>
  </v-container>
</template>

<script>
let mapboxgl, MapboxInspect
if (process.browser) {
  mapboxgl = require('mapbox-gl')
  require('mapbox-gl/dist/mapbox-gl.css')
  MapboxInspect = require('mapbox-gl-inspect')
  require('mapbox-gl-inspect/dist/mapbox-gl-inspect.css')
}

export default {
  data: () => ({
    tileJsons: process.env.tileJsons
  }),
  computed: {
    tileJson() {
      return this.tileJsons.find(t => t.id === this.$route.params.id)
    }
  },
  mounted() {
    const map = new mapboxgl.Map({
      container: 'map',
      hash: true,
      center: this.tileJson.body.center,
      zoom: this.tileJson.body.center[2] || 9,
      style: {
        version: 8,
        sources: {
          [this.tileJson.id]: {
            type: 'vector',
            url: `../../tilejson/${this.tileJson.id}.json`
          }
        },
        layers: []
      }
    })
    map.addControl(new mapboxgl.NavigationControl())
    const inspect = new MapboxInspect({
      showInspectMap: true,
      showInspectButton: false,
      selectThreshold: 50,
      popup: new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
      })
    })

    map.addControl(inspect)
    /* map.on('styledata', function() {
      var layerList = document.getElementById('layerList');
      layerList.innerHTML = '';
      Object.keys(inspect.sources).forEach(function(sourceId) {
        var layerIds = inspect.sources[sourceId];
        layerIds.forEach(function(layerId) {
          var item = document.createElement('div');
          item.innerHTML = '<div style="' +
            'background:' + inspect.assignLayerColor(layerId) + ';' +
          '"></div> ' + layerId;
          layerList.appendChild(item);
        });
      })
    });
    */
  }
}
</script>

<style lang="css" scoped>
#map {
  height: 400px;
}
</style>
