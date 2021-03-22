<template>
  <div>
    <h1 class="text-2xl">{{sourceName}}</h1>
    <!-- Use :key here to force a re-render while we fetch more data -->
    <SyncStatsContainer :key="sourceName" :source-name="sourceName" v-slot="{ stats }">
      <SyncStats :stats="stats"/>
    </SyncStatsContainer>
  </div>
</template>

<script>
import SyncStatsContainer from './SyncStatsContainer'
import SyncStats from './SyncStats'

export default {
  props: {
    sourceName: String,
  },
  components: {
    SyncStatsContainer,
    SyncStats,
  },
}
</script>
