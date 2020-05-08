<template>
  <v-app>
    <v-content>
      <nuxt />
      <notifications />
    </v-content>
  </v-app>
</template>

<script>
import Notifications from '~/components/notifications.vue'

export default {
  components: {
    Notifications
  },
  computed: {}
}

</script>

<style>
.v-navigation-drawer{
    z-index:0!important;
}
</style>
