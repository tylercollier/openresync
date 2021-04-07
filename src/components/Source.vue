<template>
  <div>
    <h1>{{sourceName}}</h1>
    <!-- Use :key here to force a re-render while we fetch more data -->
    <h2>History</h2>
    <SyncStatsContainer :key="sourceName" :source-name="sourceName" v-slot="{ stats }">
      <h3>Sync</h3>
      <SyncStats :stats="stats.sync"/>
      <h3>Purge</h3>
      <PurgeStats :stats="stats.purge"/>
    </SyncStatsContainer>
    <StatsDetailsContainer :source-name="sourceName"/>
    <QueryLoader
      :query="gql => gql`
        query CronSchedules($sourceName: String) {
          cronSchedules(sourceName: $sourceName) {
            sourceName
            sync {
              cronString
              nextDate
            }
            purge {
              cronString
              nextDate
            }
          }
        }
      `"
      :variables="{ sourceName }"
    >
      <template v-slot="data">
        <h4>Cron</h4>
        <h5>Sync</h5>
        <CronSchedule
          v-if="data.cronSchedules[0].sync"
          :cron-string="data.cronSchedules[0].sync.cronString"
          :next-date="data.cronSchedules[0].sync.nextDate"
        />
        <div v-else>Sync not enabled</div>
        <h5>Purge</h5>
        <CronSchedule
          v-if="data.cronSchedules[0].purge"
          :cron-string="data.cronSchedules[0].purge.cronString"
          :next-date="data.cronSchedules[0].purge.nextDate"
        />
        <div v-else>Purge not enabled</div>
      </template>
    </QueryLoader>
  </div>
</template>

<script>
import SyncStatsContainer from './SyncStatsContainer'
import SyncStats from './SyncStats'
import PurgeStats from './PurgeStats'
import StatsDetailsContainer from './StatsDetailsContainer'
import QueryLoader from './QueryLoader'
import CronSchedule from "@/components/CronSchedule";

export default {
  props: {
    sourceName: String,
  },
  components: {
    CronSchedule,
    SyncStatsContainer,
    SyncStats,
    PurgeStats,
    StatsDetailsContainer,
    QueryLoader,
  },
}
</script>
