<template>
  <div class="tw-flex tw-justify-between tw-items-center tw-py-2 tw-px-4 tw-bg-blue-100">
    <h1>Openresync</h1>
    <div class="tw-flex">
      <div class="tw-mr-4">
        <router-link class="tw-mr-4" to="/dashboard">Dashboard</router-link>
        <router-link to="/cron">Cron Schedules</router-link>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    sources: Array,
    sourceName: String,
  },
  methods: {
    goToSource(value) {
      this.$router.push({ path: `/sources/${value.name}` })
    },
  },
  computed: {
    selectedSource() {
      return this.sources.find(x => x.name === this.sourceName)
    },
  },
}
</script>
