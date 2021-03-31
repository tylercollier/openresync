<template>
  <div>
    <h1 class="text-2xl">{{sourceName}}</h1>
    <!-- Use :key here to force a re-render while we fetch more data -->
    <SyncStatsContainer :key="sourceName" :source-name="sourceName" v-slot="{ stats }">
      <SyncStats :stats="stats.sync"/>
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
          :cron-string="data.cronSchedules[0].sync.cronString"
          :next-date="data.cronSchedules[0].sync.nextDate"
        />
        <h5>Purge</h5>
        <CronSchedule
          :cron-string="data.cronSchedules[0].purge.cronString"
          :next-date="data.cronSchedules[0].purge.nextDate"
        />
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
