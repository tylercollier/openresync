<template>
  <query-loader
    :query="gql => gql`
      query SyncStatsDetails($sourceName: String) {
        syncStatsDetails(sourceName: $sourceName) {
          name
          num_records_in_mls
          most_recent_at
          destinations {
            name
            num_records
            most_recent_at
          }
        }
      }
    `"
    :variables="{ sourceName }"
  >
    <template v-slot="{ data, refresh }">
      <StatsDetails :stats="data.syncStatsDetails" @refresh="refresh" :source-name="sourceName" />
    </template>
  </query-loader>
</template>

<script>
import StatsDetails from './StatsDetails'

export default {
  props: {
    sourceName: String,
  },
  components: {
    StatsDetails,
  },
}
</script>
