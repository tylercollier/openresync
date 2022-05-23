<template>
  <div>
    <query-loader
      :query="gql => gql`
        fragment databaseRecordFields on DatabaseRecord {
          created_at
          updated_at
        }

        query SyncStats($sourceName: String) {
          syncStats(sourceName: $sourceName) {
            sync {
              id
              name
              batch_id
              result
              error
              ...databaseRecordFields
              resources {
                id
                name
                is_done
                ...databaseRecordFields
                destinations {
                  id
                  name
                  num_records_synced
                  ...databaseRecordFields
                }
              }
            }
            purge {
              id
              name
              batch_id
              result
              error
              ...databaseRecordFields
              resources {
                id
                name
                is_done
                ...databaseRecordFields
                destinations {
                  id
                  name
                  num_records_purged
                  ids_purged
                  ...databaseRecordFields
                }
              }
            }
            reconcile {
              id
              name
              batch_id
              result
              error
              ...databaseRecordFields
              resources {
                id
                name
                is_done
                ...databaseRecordFields
                destinations {
                  id
                  name
                  num_records_reconciled
                  ...databaseRecordFields
                }
              }
            }
          }
        }
      `"
      :variables="{ sourceName }"
    >
      <template v-slot="{ data }">
        <slot :stats="data.syncStats" />
      </template>
    </query-loader>
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
