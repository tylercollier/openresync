<template>
  <div>
    <div v-if="!stats.length">No stats</div>
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
          <template v-for="syncSource of stats">
            <tr :key="syncSource.id">
              <td>{{ getDisplayDatetime(convertBatchIdToTimestamp(syncSource.batch_id)) }}</td>
              <td>
                <b-icon v-if="syncSource.result === 'success'" icon="check-circle" variant="success" title="All resources fully synced" />
                <b-icon v-else icon="x-circle" variant="danger" title="Not all resources fully synced" />
              </td>
              <td>{{ syncSource.error }}</td>
              <td>{{ getDisplayDatetime(syncSource.created_at) }}</td>
              <td>{{ getDisplayDatetime(syncSource.updated_at) }}</td>
              <td><b-button @click="expand(syncSource.id)" variant="outline-secondary" size="sm">Detail</b-button></td>
            </tr>
            <template v-if="syncSource.id in expanded">
              <!-- We add an extra hidden row so the colors of our extra row below matches its "parent" in a striped table -->
              <tr class="tw-hidden" :key="syncSource.id + 'a'">
              </tr>
              <tr :key="syncSource.id + 'b'">
                <td colspan="6">
                  <div class="tw-px-20 tw-py-4">
                    <b-table-simple large style="width: auto;">
                      <thead>
                      <tr>
                        <th colspan="2"></th>
                      <th :colspan="syncSource.resources[0].destinations" class="text-center">
                        Num records synced to destination
                      </th>
                      </tr>
                      <tr>
                        <th>Resource</th>
                        <th>Status</th>
                        <th v-for="destination of syncSource.resources[0].destinations" :key="destination.name">{{destination.name}}</th>
                      </tr>
                      </thead>
                      <tbody>
                      <tr v-for="resource of syncSource.resources" :key="resource.name">
                        <td>{{resource.name}}</td>
                        <td>
                          <b-icon v-if="resource.is_done" icon="check-circle" variant="success" title="All destinations fully synced"></b-icon>
                          <b-icon v-else icon="x-circle" variant="danger" title="Not all destinations fully synced"></b-icon>
                        </td>
                        <td v-for="destination of resource.destinations" :key="destination.name">
                          {{destination.num_records_synced}}
												</td>
											</tr>
                      </tbody>
                    </b-table-simple>
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
