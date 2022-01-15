<template>
  <div>
    <h1>Settings</h1>
    <div class="tw-mt-4">Changes are immediately saved</div>
    <div class="tw-mt-4 form-check">
      <input class="form-check-input" type="checkbox" v-model="useRelativeTime" id="useRelativeTime" />
      &nbsp;
      <label class="form-check-label" for="useRelativeTime">Use relative time (e.g. <em>4 minutes ago</em>) instead of absolute time (e.g. 2021-10-11 10:15:02 pm MST)</label>
    </div>
  </div>
</template>

<script>
import { makeGlobalSettings } from '../lib/utils/index'

export default {
  computed: {
    ...makeGlobalSettings({
      useRelativeTime: 'useRelativeTime',
    }),
  },
}
</script>
