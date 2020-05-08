<template>
  <v-container>
    <h1 class="display-3 my-4 primary--text text-center">
      IPFS tiles
    </h1>
    <p class="mt-2 text-center">
      Experimental map tiles hosting over IPFS.
    </p>
    <p class="text-center">
      <v-btn text color="primary" to="/about">
        about
      </v-btn>
      &nbsp;
      <v-btn icon href="https://github.com/koumoul-dev/ipfs-tiles" color="primary">
        <v-icon>mdi-github</v-icon>
      </v-btn>
    </p>

    <h2 class="title mt-6 mb-2">
      Tilesets
    </h2>

    <v-card tile>
      <v-list>
        <v-list-item v-for="tileJson in tileJsons" :key="tileJson.id" :to="`/tileset/${tileJson.id}`">
          <v-list-item-content>
            <v-list-item-title v-text="tileJson.body.name" />
            <v-list-item-subtitle v-text="tileJson.body.vector_layers.map(layer => layer.id).join(', ')" />
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card>
  </v-container>
</template>

<script>
// import eventBus from '../event-bus'

export default {
  components: {},
  data: () => ({
    tileJsons: process.env.tileJsons
  })
}
</script>
