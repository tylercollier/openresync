<template>
  <div>
    <div v-if="!historyStats.length">No stats</div>
    <div v-else>
      <div v-for="mlsSource of historyStats" :key="mlsSource.name">
        <h2>{{ mlsSource.name }}</h2>
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
          <template v-for="(history, index) of mlsSource.history">
            <tr :key="index">
              <td>{{ getDisplayDatetime(convertBatchIdToTimestamp(history.batch_id)) }}</td>
              <td :class="{ 'text-success': history.result === 'success', 'text-danger': history.result === 'error' }">{{ history.result }}</td>
              <td>{{ history.error }}</td>
              <td>{{ getDisplayDatetime(history.created_at) }}</td>
              <td>{{ getDisplayDatetime(history.updated_at) }}</td>
              <td><b-button @click="expand(index)" variant="outline-secondary" size="sm">More</b-button></td>
            </tr>
            <template v-if="index in expanded">
              <!-- We add an extra hidden row so the colors of our extra row below matches its "parent" in a striped table -->
              <tr class="tw-hidden">
              </tr>
              <tr>
                <td colspan="6">
                  <div v-for="resource of history.resources" :key="resource.id" class="tw-ml-4">
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
    historyStats: Array,
  },
  data() {
    return {
      convertBatchIdToTimestamp,
      getDisplayDatetime,
      expanded: {},
    }
  },
  methods: {
    expand(index) {
      if (index in this.expanded) {
        this.$delete(this.expanded, index)
        return
      }
      this.$set(this.expanded, index, true)
    },
  },
}
</script>
