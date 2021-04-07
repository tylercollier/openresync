<template>
  <div>
    <div v-if="!stats || !stats.length">No stats</div>
    <div v-else>
      <div>
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
          <template v-for="purgeSource of stats">
            <tr :key="purgeSource.id">
              <td>{{ getDisplayDatetime(convertBatchIdToTimestamp(purgeSource.batch_id)) }}</td>
              <td :class="{ 'text-success': purgeSource.result === 'success', 'text-danger': purgeSource.result === 'error' }">{{ purgeSource.result }}</td>
              <td>{{ purgeSource.error }}</td>
              <td>{{ getDisplayDatetime(purgeSource.created_at) }}</td>
              <td>{{ getDisplayDatetime(purgeSource.updated_at) }}</td>
              <td><b-button @click="expand(purgeSource.id)" variant="outline-secondary" size="sm">More</b-button></td>
            </tr>
            <template v-if="purgeSource.id in expanded">
              <!-- We add an extra hidden row so the colors of our extra row below matches its "parent" in a striped table -->
              <tr class="tw-hidden" :key="purgeSource.id + 'a'">
              </tr>
              <tr :key="purgeSource.id + 'b'">
                <td colspan="6">
                  <div v-for="resource of purgeSource.resources" :key="resource.id" class="tw-ml-4">
                    <h3>{{resource.name}}</h3>
                    <div>Done: {{resource.is_done}}</div>
                    <div v-for="destination of resource.destinations" :key="destination.id" class="tw-ml-4">
                      <h4>{{destination.name}}</h4>
                      <div>Records purged: {{destination.num_records_purged}}</div>
                      <div>
                        IDs purged:
                        <span class="tw-text-xs align-text-top">
                          <b-badge v-b-tooltip.hover
                                   title="This is usually a subset and is meant more as proof than the full list">
                            ?
                          </b-badge>
                        </span>
                        {{destination.ids_purged.join(', ')}}
                      </div>
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
