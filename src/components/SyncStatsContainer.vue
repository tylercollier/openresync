<template>
  <div>
    <ApolloQuery
      :query="gql => gql`
        query SyncStats($sourceName: String) {
          syncStats(sourceName: $sourceName) {
            id
            name
            batch_id
            result
            error
            created_at
            updated_at
            resources {
              id
              name
              is_done
              created_at
              updated_at
              destinations {
                id
                name
                num_records_synced
                created_at
                updated_at
              }
            }
          }
        }
      `"
      :variables="{ sourceName }"
    >
      <template v-slot="{ result: { loading, error, data } }">
        <div v-if="loading">Loading...</div>
        <div v-else-if="error" class="error apollo">An error occurred</div>
        <div v-else-if="data">
          <slot :stats="data.syncStats" />
        </div>
        <div v-else class="no-result apollo">No result :(</div>
      </template>
    </ApolloQuery>
  </div>
</template>

<script>
export default {
  props: {
    sourceName: {
      type: String,
      required: false,
    },
  },
}
</script>
