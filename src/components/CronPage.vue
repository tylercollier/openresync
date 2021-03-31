<template>
  <div>
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
        <b-table-simple small striped hover>
          <thead>
          <tr>
            <th>Source name</th>
            <th>Sync cron schedule</th>
            <th>Sync next run</th>
            <th>Purge cron schedule</th>
            <th>Purge next run</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="cronSchedule of data.cronSchedules" :key="cronSchedule.sourceName">
            <td>{{cronSchedule.sourceName}}</td>
            <td><template v-if="cronSchedule.sync">{{ cronSchedule.sync.cronString }}</template></td>
            <td><template v-if="cronSchedule.sync"><DisplayDatetime :datetime="cronSchedule.sync.nextDate" /></template></td>
            <td><template v-if="cronSchedule.purge">{{cronSchedule.purge.cronString}}</template></td>
            <td><template v-if="cronSchedule.purge"><DisplayDatetime :datetime="cronSchedule.purge.nextDate" /></template></td>
          </tr>
          </tbody>
        </b-table-simple>
      </template>
    </QueryLoader>
  </div>
</template>

<script>
import QueryLoader from './QueryLoader'
import DisplayDatetime from './DisplayDatetime'

export default {
  props: {
    sourceName: {
      type: String,
      required: false,
    },
  },
  components: {
    QueryLoader,
    DisplayDatetime,
  },
}
</script>
