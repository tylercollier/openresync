<template>
  <b-table-simple small striped hover>
    <thead>
    <tr>
      <th>Source name</th>
      <th>Process</th>
      <th>Next run</th>
      <th>Cron Schedule for Type</th>
    </tr>
    </thead>
    <tbody>
    <tr v-for="(cronSchedule, index) of orderedCronSchedules()"
        :key="cronSchedule.sourceName + ':' + cronSchedule.type"
        :class="{ 'tw-opacity-50': !cronSchedule.enabled }"
    >
      <td>{{ cronSchedule.sourceName }}</td>
      <td>{{ cronSchedule.type }}</td>
      <td>
        <DisplayDatetimeCron :cron-schedule="cronSchedule" />
      </td>
      <td>
        <CronStrings :cron-strings="cronSchedule.cronStrings" />
      </td>
    </tr>
    </tbody>
  </b-table-simple>
</template>

<script>
import CronStrings from './CronStrings'
import DisplayDatetimeCron from './DisplayDatetimeCron'
import orderBy from 'lodash/orderBy'
import { getNextDateFromCronStrings, getNextTimeoutFromCronStrings } from '../../lib/sync/utils/datetime'

export default {
  props: {
    cronSchedules: Array,
  },
  data() {
    return {
      timeoutIds: new Set(),
    }
  },
  computed: {
  },
  methods: {
    orderedCronSchedules() {
      const a = []
      for (const schedule of this.cronSchedules) {
        for (let type of ['sync', 'purge', 'reconcile']) {
          if (schedule[type]) {
            a.push({
              sourceName: schedule.sourceName,
              type,
              nextDate: schedule[type].nextDate,
              cronStrings: schedule[type].cronStrings,
              enabled: schedule[type].enabled,
            })
          }
        }
      }
      const ordered = orderBy(a, x => getNextDateFromCronStrings(x.cronStrings), ['asc'])
      return ordered
    },
    setTimeoutsForDisplay() {
      for (const cronSchedule of this.orderedCronSchedules()) {
        this.setTimeoutForDisplay(cronSchedule)
      }
    },
    setTimeoutForDisplay(cronSchedule) {
      const milliseconds = getNextTimeoutFromCronStrings(cronSchedule.cronStrings)
      const timeoutId = setTimeout(() => {
        this.timeoutIds.delete(timeoutId)
        this.setTimeoutForDisplay(cronSchedule)
      }, milliseconds)
      this.timeoutIds.add(timeoutId)
    },
  },
  mounted() {
    this.setTimeoutsForDisplay()
  },
  beforeDestroy() {
    for (const timeoutId of this.timeoutIds) {
      clearTimeout(timeoutId)
    }
  },
  components: {
    CronStrings,
    DisplayDatetimeCron,
  },
}
</script>
