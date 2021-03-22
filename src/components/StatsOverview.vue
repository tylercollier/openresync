<template>
  <div>
    <div v-for="(syncStats, sourceName) in groupedStats" :key="sourceName">
      <SyncStats :stats="syncStats" :show-header="true" />
    </div>
  </div>
</template>

<script>
import SyncStats from './SyncStats'
import groupBy from 'lodash/groupBy'

export default {
  props: {
    stats: Array,
  },
  computed: {
    groupedStats() {
      return groupBy(this.stats, x => x.name)
    },
  },
  components: {
    SyncStats,
  },
}
</script>
