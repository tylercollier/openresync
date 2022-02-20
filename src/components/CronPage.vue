<template>
  <div>
    <h1 class="tw-font-bold tw-border-gray-700 tw-border-dotted tw-border-b-2 tw-mb-8">Cron Schedules</h1>
    <b-form-group label="Sort by">
      <b-form-radio-group class="mb-4" v-model="orderByName" :options="orderByOptions"/>
    </b-form-group>
    <query-loader
      :query="gql => gql`
        query CronSchedules($sourceName: String) {
          cronSchedules(sourceName: $sourceName) {
            sourceName
            sync {
              cronStrings
              nextDate
              enabled
            }
            purge {
              cronStrings
              nextDate
              enabled
            }
            reconcile {
              cronStrings
              nextDate
              enabled
            }
          }
        }
      `"
      :variables="{ sourceName }"
    >
      <template v-slot="{ data, refresh }">
        <div class="mb-4">
          <b-button @click="refresh" size="sm" variant="outline-success">
            <b-icon icon="arrow-repeat" /> Refresh
          </b-button>
        </div>
        <div v-if="orderByName === 'userConfig'">
          <CronSchedulesUserConfig :cron-schedules="data.cronSchedules" />
        </div>
        <div v-else-if="orderByName === 'datetime'">
          <CronSchedulesNextRun :cron-schedules="data.cronSchedules" />
        </div>
        <div class="tw-text-sm tw-text-gray-400">
          Disabled cron jobs show as grey
        </div>
      </template>
    </query-loader>
  </div>
</template>

<script>
import CronSchedulesNextRun from './CronSchedulesNextRun'
import CronSchedulesUserConfig from './CronSchedulesUserConfig'
import { makeGlobalSettings } from '../lib/utils/index'

const orderByOptions = [
  { text: 'Sources listed in user config', value: 'userConfig' },
  { text: 'Next run', value: 'datetime' },
]

export default {
  props: {
    sourceName: {
      type: String,
      required: false,
    },
  },
  data() {
    return {
      orderByOptions,
    }
  },
  computed: {
    ...makeGlobalSettings({
      orderByName: 'cronPage.orderByName',
    }),
  },
  components: {
    CronSchedulesNextRun,
    CronSchedulesUserConfig,
  },
}
</script>
