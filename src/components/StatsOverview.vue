<template>
  <!-- The mr-4 here is to counter the margin-right: -15px on the b-card-group, which causes a horizontal scrollbar -->
  <div class="tw-mr-4">
    <b-card-group deck>
      <b-card
        v-for="(s, sourceName) in groupedStats"
        :key="sourceName"
        style="flex: 0 1 20rem;"
      >
        <b-card-title class="tw-font-bold">{{sourceName}}</b-card-title>
        <b-card-text>
          <div v-if="s.sync.length">
            <div>Last sync batch:<div class="tw-ml-4" style="color: #388dc0;">{{ s.sync[0].batch_id }}</div></div>
            <div>Status:
              <b-icon v-if="s.sync[0].result === 'success'" icon="check-circle" variant="success" title="All resources were fully purged" />
              <b-icon v-else icon="x-circle" variant="danger" title="Not all resources were fully purged" />
            </div>
          </div>
          <div v-else>
            <em>Never synced</em>
          </div>
          <div v-if="s.purge.length && sourceName === 'aborTrestle'" class="tw-mt-2 tw-text-sm">
            <div>Last purge batch:<div class="tw-ml-4" style="color: #388dc0;">{{ s.purge[0].batch_id }}</div></div>
            <div>Status:
              <b-icon v-if="s.purge[0].result === 'success'" icon="check-circle" variant="success" title="All resources were fully purged" />
              <b-icon v-else icon="x-circle" variant="danger" title="Not all resources were fully purged" />

            </div>
          </div>
          <!-- Here's a hack to add an equivalent amount of space if there is no purge data -->
          <div v-else class="tw-invisible tw-mt-2 tw-text-sm">
            <div>Last purge batch</div>
            <div>Status:</div>
            <div>-</div>
          </div>
        </b-card-text>
        <b-button class="tw-mt-4" style="background: #d78326;" :to="`/sources/${sourceName}`">View details</b-button>
      </b-card>
    </b-card-group>
  </div>
</template>

<script>
import groupBy from 'lodash/groupBy'
import union from 'lodash/union'
import keyBy from 'lodash/keyBy'
import mapValues from 'lodash/mapValues'

export default {
  props: {
    stats: Object,
  },
  computed: {
    groupedStats() {
      const groupedSyncStats = groupBy(this.stats.sync, x => x.name)
      const groupedPurgeStats = groupBy(this.stats.purge, x => x.name)
      const sources = union(Object.keys(groupedSyncStats), Object.keys(groupedPurgeStats))
      const x = mapValues(keyBy(sources, x => x), x => ({
        sync: groupedSyncStats[x],
        purge: groupedPurgeStats[x],
      }))
      return x
    },
  },
  components: {
  },
}
</script>
