<template>
  <div>
    <h1>Settings</h1>
    <div class="tw-mt-4">Changes are immediately saved</div>
    <div class="tw-mt-4 form-check">
      <input class="form-check-input" type="checkbox" :checked="useRelativeTime" @change="toggleUseRelativeTime" id="useRelativeTime" />
      &nbsp;
      <label class="form-check-label" for="useRelativeTime">Use relative time (e.g. <em>4 minutes ago</em>) instead of absolute time (e.g. 2021-10-11 10:15:02 pm MST)</label>
    </div>
  </div>
</template>

<script>
import settings from '../settings'

export default {
  computed: {
    useRelativeTime() {
      return this.$globals.useRelativeTime
    }
  },
  methods: {
    toggleUseRelativeTime() {
      this.$globals.useRelativeTime = !this.$globals.useRelativeTime
      const temp = Object.assign({}, this.$globals.$data)
      delete temp.$apolloData
      settings.saveSettings(temp)
    },
  }
}
</script>
