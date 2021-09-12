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
            <th></th>
          </tr>
          </thead>
          <tbody>
          <template v-for="reconcileSource of stats">
            <tr :key="reconcileSource.id">
              <td>{{ getDisplayDatetime(convertBatchIdToTimestamp(reconcileSource.batch_id)) }}</td>
              <td>
                <b-icon v-if="reconcileSource.result === 'success'" icon="check-circle" variant="success" title="All resources fully reconciled" />
                <b-icon v-else icon="x-circle" variant="danger" title="Not all resources fully reconciled" />
              </td>
              <td>{{ reconcileSource.error }}</td>
              <td>{{ getDisplayDatetime(reconcileSource.created_at) }}</td>
              <td>{{ getDisplayDatetime(reconcileSource.updated_at) }}</td>
              <td><b-button @click="expand(reconcileSource.id)" variant="outline-secondary" size="sm">Detail</b-button></td>
            </tr>
            <template v-if="reconcileSource.id in expanded">
              <!-- We add an extra hidden row so the colors of our extra row below matches its "parent" in a striped table -->
              <tr class="tw-hidden" :key="reconcileSource.id + 'a'">
              </tr>
              <tr :key="reconcileSource.id + 'b'">
                <td colspan="6">
                  <div class="tw-px-20 tw-py-4">
                    <b-table-simple large style="width: auto;">
                      <thead>
                      <tr>
                        <th colspan="2"></th>
                      <th :colspan="reconcileSource.resources[0].destinations.length" class="text-center">
                        Num records reconciled to destination
                      </th>
                      </tr>
                      <tr class="text-center">
                        <th>Resource</th>
                        <th>Status</th>
                        <th v-for="destination of reconcileSource.resources[0].destinations" :key="destination.name">{{destination.name}}</th>
                      </tr>
                      </thead>
                      <tbody>
                      <tr v-for="resource of reconcileSource.resources" :key="resource.name">
                        <td>{{resource.name}}</td>
                        <td class="text-center">
                          <b-icon v-if="resource.is_done" icon="check-circle" variant="success" title="All destinations fully reconciled"></b-icon>
                          <b-icon v-else icon="x-circle" variant="danger" title="Not all destinations fully reconciled"></b-icon>
                        </td>
                        <td class="text-right" v-for="destination of resource.destinations" :key="destination.name">
                          {{destination.num_records_reconciled}}
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
