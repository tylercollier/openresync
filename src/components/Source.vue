<template>
  <div>
    <h1 class="tw-font-bold tw-border-gray-700 tw-border-dotted tw-border-b-2 tw-mb-8">Source: {{sourceName}}</h1>
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
          <h2 class="tw-mb-4" style="color: #388dbf;">Cron Schedules</h2>
          <CronSchedules :schedules="data.cronSchedules" />
        </template>
      </QueryLoader>
    </div>
    <div class="tw-mb-8">
      <h2 style="color: #388dbf;">Resources</h2>
      <StatsDetailsContainer :source-name="sourceName"/>
    </div>
    <div>
      <h2 style="color: #388dbf;">History</h2>
      <!-- Use :key here to force a re-render while we fetch more data -->
      <SyncStatsContainer :key="sourceName" :source-name="sourceName" v-slot="{ stats }">
        <h3>Sync</h3>
        <SyncStats :stats="stats.sync"/>
        <h3>Purge</h3>
        <PurgeStats :stats="stats.purge"/>
      </SyncStatsContainer>
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
