<template>
  <div>
    <QueryLoader
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
      <template v-slot="data">
        <slot :stats="data.syncStats" />
      </template>
    </QueryLoader>
  </div>
</template>

<script>
import QueryLoader from './QueryLoader'

export default {
  props: {
    sourceName: {
      type: String,
      required: false,
    },
  },
  components: {
    QueryLoader,
  },
}
</script>
