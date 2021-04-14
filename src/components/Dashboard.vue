<template>
  <div>
    <SyncStatsContainer v-slot="{ stats }">
      <StatsOverview :stats="stats"/>
    </SyncStatsContainer>
  </div>
</template>

<script>
import SyncStatsContainer from './SyncStatsContainer'
import StatsOverview from './StatsOverview'

export default {
  components: {
    SyncStatsContainer,
    StatsOverview,
  },
}
</script>
