<template>
  <div>
    <div v-if="!stats.length">No stats</div>
    <div v-else>
      <div>
        <h2>{{ stats[0].name }}</h2>
        <b-table-simple small striped hover>
          <thead>
          <tr>
            <th>Batch timestamp</th>
            <th>Result</th>
            <th>Error</th>
            <th>Started</th>
            <th>Ended</th>
            <th>Actions</th>
          </tr>
          </thead>
          <tbody>
          <template v-for="syncSource of stats">
            <tr :key="syncSource.id">
              <td>{{ getDisplayDatetime(convertBatchIdToTimestamp(syncSource.batch_id)) }}x{{syncSource.id}}</td>
              <td :class="{ 'text-success': syncSource.result === 'success', 'text-danger': syncSource.result === 'error' }">{{ syncSource.result }}</td>
              <td>{{ syncSource.error }}</td>
              <td>{{ getDisplayDatetime(syncSource.created_at) }}</td>
              <td>{{ getDisplayDatetime(syncSource.updated_at) }}</td>
              <td><b-button @click="expand(syncSource.id)" variant="outline-secondary" size="sm">More</b-button></td>
            </tr>
            <template v-if="syncSource.id in expanded">
              <!-- We add an extra hidden row so the colors of our extra row below matches its "parent" in a striped table -->
              <tr class="tw-hidden" :key="syncSource.id + 'a'">
              </tr>
              <tr :key="syncSource.id + 'b'">
                <td colspan="6">
                  <div v-for="resource of syncSource.resources" :key="resource.id" class="tw-ml-4">
                    <h3>{{resource.name}}</h3>
                    <div>Done: {{resource.is_done}}</div>
                    <div v-for="destination of resource.destinations" :key="destination.id" class="tw-ml-4">
                      <h4>{{destination.name}}</h4>
                      <div>Records synced: {{destination.num_records_synced}}</div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </template>
          </tbody>
        </b-table-simple>
      </div>
    </div>
  </div>
</template>

<script>
import { getDisplayDatetime, convertBatchIdToTimestamp } from '../../lib/sync/utils/datetime'

export default {
  props: {
    stats: Array,
  },
  data() {
    return {
      convertBatchIdToTimestamp,
      getDisplayDatetime,
      expanded: {},
    }
  },
  methods: {
    expand(sourceId) {
      if (sourceId in this.expanded) {
        this.$delete(this.expanded, sourceId)
        return
      }
      this.$set(this.expanded, sourceId, true)
    },
  },
}
</script>
