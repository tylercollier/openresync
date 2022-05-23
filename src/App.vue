<template>
  <JobsProvider>
    <router-view></router-view>
  </JobsProvider>
</template>

<script>
import JobsProvider from './components/JobsProvider'

export default {
  components: {
    JobsProvider,
  },
}
</script>
