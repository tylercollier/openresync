<template>
  <div>
    <h1 class="text-2xl">{{sourceName}}</h1>
    <!-- Use :key here to force a re-render while we fetch more data -->
    <SyncStatsContainer :key="sourceName" :source-name="sourceName" v-slot="{ stats }">
      <SyncStats :stats="stats"/>
    </SyncStatsContainer>
    <StatsDetailsContainer :source-name="sourceName"/>
  </div>
</template>

<script>
import SyncStatsContainer from './SyncStatsContainer'
import SyncStats from './SyncStats'
import StatsDetailsContainer from './StatsDetailsContainer'

export default {
  props: {
    sourceName: String,
  },
  components: {
    SyncStatsContainer,
    SyncStats,
    StatsDetailsContainer,
  },
}
</script>
