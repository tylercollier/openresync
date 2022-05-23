<template>
  <b-table-simple small striped hover>
    <thead>
    <tr>
      <th>Source name</th>
      <th>Sync cron schedule</th>
      <th>Sync next run</th>
      <th>Purge cron schedule</th>
      <th>Purge next run</th>
      <th>Reconcile cron schedule</th>
      <th>Reconcile next run</th>
    </tr>
    </thead>
    <tbody>
    <tr v-for="cronSchedule of cronSchedules" :key="cronSchedule.sourceName">
      <td>{{cronSchedule.sourceName}}</td>
      <td>
        <template v-if="cronSchedule.sync">
          <CronStrings :cron-strings="cronSchedule.sync.cronStrings" :enabled="cronSchedule.sync.enabled" />
        </template>
        <template v-else>
          <span class="tw-text-gray-400">N/A</span>
        </template>
      </td>
      <td>
        <template v-if="cronSchedule.sync">
          <DisplayDatetimeCron
            :cron-schedule="cronSchedule.sync"
            :class="{ 'tw-text-gray-400': !cronSchedule.sync.enabled }"
          />
        </template>
        <template v-else>
          <span class="tw-text-gray-400">N/A</span>
        </template>
      </td>
      <td>
        <template v-if="cronSchedule.purge">
          <CronStrings :cron-strings="cronSchedule.purge.cronStrings" :enabled="cronSchedule.purge.enabled" />
        </template>
        <template v-else>
          <span class="tw-text-gray-400">N/A</span>
        </template>
      </td>
      <td>
        <template v-if="cronSchedule.purge">
          <DisplayDatetimeCron
            :cron-schedule="cronSchedule.purge"
            :class="{ 'tw-text-gray-400': !cronSchedule.purge.enabled }"
          />
        </template>
        <template v-else>
          <span class="tw-text-gray-400">N/A</span>
        </template>
      </td>
      <td>
        <template v-if="cronSchedule.reconcile">
          <CronStrings :cron-strings="cronSchedule.reconcile.cronStrings" :enabled="cronSchedule.reconcile.enabled" />
        </template>
        <template v-else>
          <span class="tw-text-gray-400">N/A</span>
        </template>
      </td>
      <td>
        <template v-if="cronSchedule.reconcile">
          <DisplayDatetimeCron
            :cron-schedule="cronSchedule.reconcile"
            :class="{ 'tw-text-gray-400': !cronSchedule.reconcile.enabled }"
          />
        </template>
        <template v-else>
          <span class="tw-text-gray-400">N/A</span>
        </template>
      </td>
    </tr>
    </tbody>
  </b-table-simple>
</template>

<script>
import DisplayDatetimeCron from './DisplayDatetimeCron'
import CronStrings from './CronStrings'

export default {
  props: {
    cronSchedules: Array,
  },
  components: {
    DisplayDatetimeCron,
    CronStrings,
  },
}
</script>
