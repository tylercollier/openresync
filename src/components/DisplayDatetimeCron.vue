<template>
  <span>
    <template v-if="cronSchedule.nextDate">
      <span v-b-tooltip.hover :title="getOtherDisplayDatetime(datetime)">{{getPreferredDisplayDatetime(datetime)}}</span>
    </template>
    <template v-else>N/A</template>
  </span>
</template>

<script>
import { getDisplayDatetime, getMillisecondsUntilUpcomingRelativeTimeChange } from '../../lib/sync/utils/datetime'
import moment from 'moment'
import { CronJob } from 'cron'

export default {
  props: {
    // We expect a moment object or a string like from the database
    cronSchedule: Object,
  },
  data() {
    return {
      datetime: this.cronSchedule.nextDate,
      timeoutId: null,
    }
  },
  methods: {
    getPreferredDisplayDatetime(datetime) {
      return getDisplayDatetime(datetime, this.$globals.useRelativeTime)
    },
    getOtherDisplayDatetime(datetime) {
      return getDisplayDatetime(datetime, !this.$globals.useRelativeTime)
    },
    setTimeoutForDisplay() {
      if (this.$globals.useRelativeTime
        // && this.cronSchedule.sourceName === 'recolorado_res'
        // && this.cronSchedule.type === 'sync'
      ) {
        console.log(this.cronSchedule.sourceName + ' ' + this.cronSchedule.type + ' in setTimeoutForDisplay')
        const cronJob = new CronJob(this.cronSchedule.cronStrings[0], () => {})
        const nextDate = cronJob.nextDate()
        console.log(this.cronSchedule.sourceName + ' ' + this.cronSchedule.type + ' nextDate', nextDate.toISOString())
        this.datetime = nextDate

        // Add 100 milliseconds just to make sure it doesn't trigger too early and the text doesn't update
        const milliseconds = 100 + getMillisecondsUntilUpcomingRelativeTimeChange(moment.utc(), nextDate)
        console.log(this.cronSchedule.sourceName + ' ' + this.cronSchedule.type + ' It is currently: ' + moment.utc().toISOString())
        console.log(this.cronSchedule.sourceName + ' ' + this.cronSchedule.type + ' milliseconds', milliseconds)
        this.timeoutId = setTimeout(this.setTimeoutForDisplay, milliseconds)
      }
    },
  },
  mounted() {
    this.setTimeoutForDisplay()
  },
  beforeDestroy() {
    clearTimeout(this.timeoutId)
  },
  watch: {
    '$globals.useRelativeTime'(newValue) {
      if (newValue) {
        this.setTimeoutForDisplay()
      }
    },
  },
}
</script>
