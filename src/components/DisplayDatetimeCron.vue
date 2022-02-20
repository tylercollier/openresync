<template>
  <span>
    <template v-if="cronSchedule.nextDate">
      <span v-b-tooltip.hover :title="getOtherDisplayDatetime(datetime)">{{getPreferredDisplayDatetime(datetime)}}</span>
    </template>
    <template v-else>N/A</template>
  </span>
</template>

<script>
import {
  getDisplayDatetime,
  getMillisecondsUntilUpcomingRelativeTimeChange,
  getNextDateFromCronStrings,
} from '../../lib/sync/utils/datetime'
import moment from 'moment'

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
      if (this.$globals.useRelativeTime) {
        const nextDate = getNextDateFromCronStrings(this.cronSchedule.cronStrings)
        this.datetime = nextDate

        const milliseconds = getMillisecondsUntilUpcomingRelativeTimeChange(moment.utc(), nextDate)
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
