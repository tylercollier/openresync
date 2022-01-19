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
            <tr v-for="cronSchedule of data.cronSchedules" :key="cronSchedule.sourceName">
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
                  <DisplayDatetime
                    :datetime="cronSchedule.sync.nextDate"
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
                  <DisplayDatetime
                    :datetime="cronSchedule.purge.nextDate"
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
                  <DisplayDatetime
                    :datetime="cronSchedule.reconcile.nextDate"
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
        </div>
        <div v-else-if="orderByName === 'datetime'">
          <b-table-simple small striped hover>
            <thead>
            <tr>
              <th>Source name</th>
              <th>Process</th>
              <th>Next run</th>
              <th>Cron Schedule for Type</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="(cronSchedule, index) of orderedCronSchedules(data.cronSchedules, orderByName)"
                :key="index"
                :class="{ 'tw-opacity-50': !cronSchedule.enabled }"
            >
              <td>{{ cronSchedule.sourceName }}</td>
              <td>{{ cronSchedule.type }}</td>
              <td>
                <DisplayDatetime :datetime="cronSchedule.nextDate" />
              </td>
              <td>
                <CronStrings :cron-strings="cronSchedule.cronStrings" />
              </td>
            </tr>
            </tbody>
          </b-table-simple>
        </div>
        <div class="tw-text-sm tw-text-gray-400">
          Disabled cron jobs show as grey
        </div>
      </template>
    </query-loader>
  </div>
</template>

<script>
import DisplayDatetime from './DisplayDatetime'
import CronStrings from './CronStrings'
import orderBy from 'lodash/orderBy'
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
    // orderByName: utils.makeGlobalSetting('cronPage.orderByName'),
    ...makeGlobalSettings({
      orderByName: 'cronPage.orderByName',
    }),
  },
  methods: {
    orderedCronSchedules(schedules, orderByName) {
      if (orderByName === 'datetime') {
        const a = []
        for (const schedule of schedules) {
          for (let type of ['sync', 'purge', 'reconcile']) {
            if (schedule[type]) {
              a.push({
                sourceName: schedule.sourceName,
                type,
                nextDate: schedule[type].nextDate,
                cronStrings: schedule[type].cronStrings,
                enabled: schedule[type].enabled,
              })
            }
          }
        }
        const ordered = orderBy(a, ['nextDate'], ['asc'])
        return ordered
      } else {
        return schedules
      }
    },
  },
  components: {
    DisplayDatetime,
    CronStrings,
  },
}
</script>
