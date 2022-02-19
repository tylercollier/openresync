<template>
  <span>
    <template v-if="datetime">
      <span v-b-tooltip.hover :title="getOtherDisplayDatetime(datetime)">{{getPreferredDisplayDatetime(datetime)}}</span>
    </template>
    <template v-else>N/A</template>
  </span>
</template>

<script>
import { getDisplayDatetime, getMillisecondsUntilRelativeTimeChange } from '../../lib/sync/utils/datetime'
import moment from 'moment'

export default {
  props: {
    // We expect a moment object or a string like from the database
    datetime: [Object, String],
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
        this.$forceUpdate()

        // Ensure a moment
        const m = moment.utc(this.datetime)
        const milliseconds = getMillisecondsUntilRelativeTimeChange(m, moment.utc())
        setTimeout(this.setTimeoutForDisplay, milliseconds)
      }
    },
  },
  mounted() {
    this.setTimeoutForDisplay()
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
