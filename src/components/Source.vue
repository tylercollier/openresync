<template>
  <div>
    <h1 class="tw-bg-gray-200 p-2">Source: {{sourceName}}</h1>
    <div class="tw-mb-8">
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
          <h2>Cron Schedules</h2>
          <CronSchedules :schedules="data.cronSchedules" />
        </template>
      </QueryLoader>
    </div>
    <!-- Use :key here to force a re-render while we fetch more data -->
    <div class="tw-mb-8">
      <h2>History</h2>
      <SyncStatsContainer :key="sourceName" :source-name="sourceName" v-slot="{ stats }">
        <h3>Sync</h3>
        <SyncStats :stats="stats.sync"/>
        <h3>Purge</h3>
        <PurgeStats :stats="stats.purge"/>
      </SyncStatsContainer>
    </div>
    <div>
      <h2>Resources</h2>
      <StatsDetailsContainer :source-name="sourceName"/>
    </div>
  </div>
</template>

<script>
import SyncStatsContainer from './SyncStatsContainer'
import SyncStats from './SyncStats'
import PurgeStats from './PurgeStats'
import StatsDetailsContainer from './StatsDetailsContainer'
import QueryLoader from './QueryLoader'
import CronSchedules from "@/components/CronSchedules";

export default {
  props: {
    sourceName: String,
  },
  components: {
    CronSchedules,
    SyncStatsContainer,
    SyncStats,
    PurgeStats,
    StatsDetailsContainer,
    QueryLoader,
  },
}
</script>
