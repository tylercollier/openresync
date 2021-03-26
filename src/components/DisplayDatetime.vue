<template>
  <span>
    <template v-if="datetime">{{getDisplayDatetime(datetime)}}</template>
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
  data() {
    return {
      getDisplayDatetime,
    }
  },
}
</script>
