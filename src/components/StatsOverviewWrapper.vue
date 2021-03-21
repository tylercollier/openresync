<template>
  <div>
    <div>StatsOverviewWrapper</div>
    <div>x: {{x}}</div>
  </div>
</template>

<script>
import StatsOverview from './StatsOverview'

export default {
  props: {
    x: Object,
  },
  data() {
    console.log('this.$props', this.$props)
    return {}
  },
  components: {
    StatsOverview,
  },
}
</script>
