<template>
  <QueryLoader
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
    <template v-slot="{ data }">
      <StatsDetails :stats="data.syncStatsDetails" />
    </template>
  </QueryLoader>
</template>

<script>
import QueryLoader from './QueryLoader'
import StatsDetails from './StatsDetails'

export default {
  props: {
    sourceName: {
      type: String,
      required: false,
    },
  },
  components: {
    QueryLoader,
    StatsDetails,
  },
}
</script>
