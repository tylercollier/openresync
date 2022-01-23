<template>
  <div class="tw-flex tw-justify-between tw-items-center tw-py-2 tw-px-4 tw-text-white" style="background: #0a3d5b;">
    <h1 class="tw-font-bold tw-py-2">Openresync</h1>
    <div class="tw-flex tw-mr-8 tw-font-bold">
      <router-link class="tw-mr-8 tw-text-white" :style="styles('/jobs')" to="/jobs">
        Jobs (<span v-if="jobsProvider.loading"><b-spinner small /></span><span v-else-if="jobsProvider.error">?</span><span v-else>{{jobsProvider.jobs.length}}</span>)
      </router-link>
      <router-link class="tw-mr-8 tw-text-white" :style="styles('/dashboard')" to="/dashboard">
        Dashboard
      </router-link>
      <router-link to="/cron" class="tw-mr-8 tw-text-white" :style="styles('/cron')">
        Cron Schedules
      </router-link>
      <router-link to="/settings" class="tw-text-white" :style="styles('/settings')">
        <b-icon icon="gear" />
        Settings
      </router-link>
    </div>
  </div>
</template>

<script>

export default {
  inject: ['jobsProvider'],
  props: {
    sources: Array,
    sourceName: String,
  },
  methods: {
    goToSource(value) {
      this.$router.push({ path: `/sources/${value.name}` })
    },
    styles(routePath) {
      if (this.$route.path === routePath) {
        return {
          color: '#d78326',
        }
      }
      return {}
    },
  },
  computed: {
    selectedSource() {
      return this.sources.find(x => x.name === this.sourceName)
    },
  },
}
</script>
