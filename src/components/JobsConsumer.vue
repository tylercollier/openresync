<template>
  <span>
    <b-spinner v-if="jobsProvider.loading" small />
    <span v-else-if="jobsProvider.error" class="error">An error occurred</span>
    <slot v-else v-bind="{ runningJobs: jobsProvider.runningJobs }" />
  </span>
</template>

<script>
export default {
  inject: ['jobsProvider'],
}
</script>
