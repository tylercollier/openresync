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
    datetime: Object,
  },
  data() {
    return {
      getDisplayDatetime,
    }
  },
}
</script>
