<template>
  <div>
    <h1 class="text-2xl">{{sourceName}}</h1>
    <div>some text</div>
    <SyncStatsContainer />
  </div>
</template>

<script>
import SyncStatsContainer from './SyncStatsContainer'

export default {
  props: {
    sourceName: String,
  },
  components: {
    SyncStatsContainer,
  },
}
</script>
