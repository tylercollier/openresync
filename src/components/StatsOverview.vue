<template>
  <div>
    <div v-for="(s, sourceName) in groupedStats" :key="sourceName">
      <StatsHeader :source-name="sourceName" />
      <h3>Sync</h3>
      <SyncStats :stats="s.sync" />
      <h3>Purge</h3>
      <PurgeStats :stats="s.purge" />
    </div>
  </div>
</template>

<script>
import SyncStats from './SyncStats'
import PurgeStats from './PurgeStats'
import StatsHeader from './StatsHeader'
import groupBy from 'lodash/groupBy'
import union from 'lodash/union'
import keyBy from 'lodash/keyBy'
import mapValues from 'lodash/mapValues'

export default {
  props: {
    stats: Object,
  },
  computed: {
    groupedStats() {
      const groupedSyncStats = groupBy(this.stats.sync, x => x.name)
      const groupedPurgeStats = groupBy(this.stats.purge, x => x.name)
      const sources = union(Object.keys(groupedSyncStats), Object.keys(groupedPurgeStats))
      const x = mapValues(keyBy(sources, x => x), x => ({
        sync: groupedSyncStats[x],
        purge: groupedPurgeStats[x],
      }))
      return x
    },
  },
  components: {
    SyncStats,
    PurgeStats,
    StatsHeader,
  },
}
</script>
