<template>
  <div>
    Dashboard
    <div v-if="!historyStats.length">No stats</div>
    <div v-else>
      <div v-for="mlsSource of historyStats" :key="mlsSource.name">
        <h2>{{mlsSource.name}}</h2>
        <table class="striped">
          <thead>
          <tr>
            <th>Batch timestamp</th>
            <th>Result</th>
            <th>Error</th>
            <th>Started</th>
            <th>Ended</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(history, index) of mlsSource.history" :key="index">
            <td>{{getDisplayDatetime(convertBatchIdToTimestamp(history.batch_id))}}</td>
            <td>{{history.result}}</td>
            <td>{{history.error}}</td>
            <td>{{getDisplayDatetime(history.created_at)}}</td>
            <td>{{getDisplayDatetime(history.updated_at)}}</td>
          </tr>
          </tbody>
        </table>
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
    }
  },
}
</script>
