<template>
  <div class="g">
    <div><span class="tw-font-bold">Next sync:</span></div>
    <div class="ml-2">
      <DisplayDatetimeCron
        v-if="schedules.length && schedules[0].sync"
        :cron-schedule="schedules[0].sync"
        :class="{ 'tw-text-gray-400': !schedules[0].sync.enabled }"
      />
    </div>
    <div><span class="tw-font-bold">Sync schedule:</span></div>
    <div class="ml-2">
      <div v-if="schedules.length && schedules[0].sync">
        <CronStrings :cron-strings="schedules[0].sync.cronStrings" :enabled="schedules[0].sync.enabled" />
      </div>
    </div>
    <div><span class="tw-font-bold">Next purge:</span></div>
    <div class="ml-2">
      <DisplayDatetimeCron
        v-if="schedules.length && schedules[0].purge"
        :cron-schedule="schedules[0].purge"
        :class="{ 'tw-text-gray-400': !schedules[0].purge.enabled }"
      />
    </div>
    <div><span class="tw-font-bold">Purge schedule:</span></div>
    <div class="ml-2">
      <div v-if="schedules.length && schedules[0].purge">
        <CronStrings :cron-strings="schedules[0].purge.cronStrings" :enabled="schedules[0].sync.enabled" />
      </div>
    </div>
    <div><span class="tw-font-bold">Next reconcile:</span></div>
    <div class="ml-2">
      <DisplayDatetimeCron
        v-if="schedules.length && schedules[0].reconcile"
        :cron-schedule="schedules[0].reconcile"
        :class="{ 'tw-text-gray-400': !schedules[0].reconcile.enabled }"
      />
    </div>
    <div><span class="tw-font-bold">Reconcile schedule:</span></div>
    <div class="ml-2">
      <div v-if="schedules.length && schedules[0].reconcile">
        <CronStrings :cron-strings="schedules[0].reconcile.cronStrings" :enabled="schedules[0].sync.enabled" />
      </div>
    </div>
    <div class="tw-text-sm tw-text-gray-400">
      Disabled cron jobs show as grey
    </div>
  </div>
</template>

<script>
import CronStrings from './CronStrings'
import DisplayDatetimeCron from './DisplayDatetimeCron'

export default {
  props: {
    schedules: Array,
  },
  components: {
    CronStrings,
    DisplayDatetimeCron,
  },
}
</script>

<style type="scss" scoped>
.g {
  display: inline-grid;
  grid-template-columns: repeat(4, auto);
  grid-column-gap: 4px;
}

.g > :nth-child(3), .g > :nth-child(7), .g > :nth-child(11) {
  margin-left: 40px;
}

code {
  color: black;
}
</style>
