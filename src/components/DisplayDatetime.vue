<template>
  <span>
    <template v-if="datetime">
      <span v-b-tooltip.hover :title="getOtherDisplayDatetime(datetime)">{{getPreferredDisplayDatetime(datetime)}}</span>
    </template>
    <template v-else>N/A</template>
  </span>
</template>

<script>
import { getDisplayDatetime } from '../../lib/sync/utils/datetime'

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
    }
  },
}
</script>
