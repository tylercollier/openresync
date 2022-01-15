<template>
  <div>
    <h1 class="tw-font-bold tw-border-gray-700 tw-border-dotted tw-border-b-2 tw-mb-8">Cron Schedules</h1>
    <b-form-group label="Sort by">
      <b-form-radio-group class="mb-4" v-model="orderByName" :options="orderByOptions"/>
    </b-form-group>
    <QueryLoader
      :query="gql => gql`
        query CronSchedules($sourceName: String) {
          cronSchedules(sourceName: $sourceName) {
            sourceName
            sync {
              cronStrings
              nextDate
            }
            purge {
              cronStrings
              nextDate
            }
            reconcile {
              cronStrings
              nextDate
            }
          }
        }
      `"
      :variables="{ sourceName }"
    >
      <template v-slot="data">
        <b-table-simple v-if="orderByName === 'userConfig'" small striped hover>
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
                <code class="tw-text-black">
                  <CronStrings :cron-strings="cronSchedule.sync.cronStrings" />
                </code>
              </template>
            </td>
            <td><template v-if="cronSchedule.sync"><DisplayDatetime :datetime="cronSchedule.sync.nextDate" /></template></td>
            <td>
              <template v-if="cronSchedule.purge">
                <code class="tw-text-black">
                  <CronStrings :cron-strings="cronSchedule.purge.cronStrings" />
                </code>
              </template>
            </td>
            <td><template v-if="cronSchedule.purge"><DisplayDatetime :datetime="cronSchedule.purge.nextDate" /></template></td>
            <td>
              <template v-if="cronSchedule.reconcile">
                <code class="tw-text-black">
                  <CronStrings :cron-strings="cronSchedule.reconcile.cronStrings" />
                </code>
              </template>
            </td>
            <td><template v-if="cronSchedule.reconcile"><DisplayDatetime :datetime="cronSchedule.reconcile.nextDate" /></template></td>
          </tr>
          </tbody>
        </b-table-simple>
        <b-table-simple v-else-if="orderByName === 'datetime'" small striped hover>
          <thead>
          <tr>
            <th>Source name</th>
            <th>Process</th>
            <th>Next run</th>
            <th>Cron Schedule for Type</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(cronSchedule, index) of orderedCronSchedules(data.cronSchedules, orderByName)" :key="index">
            <td>{{cronSchedule.sourceName}}</td>
            <td>{{cronSchedule.type}}</td>
            <td><DisplayDatetime :datetime="cronSchedule.nextDate"/></td>
            <td>
              <code class="tw-text-black">
                <CronStrings :cron-strings="cronSchedule.cronStrings" />
              </code>
            </td>
          </tr>
          </tbody>
        </b-table-simple>
      </template>
    </QueryLoader>
  </div>
</template>

<script>
import QueryLoader from './QueryLoader'
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
    QueryLoader,
    DisplayDatetime,
    CronStrings,
  },
}
</script>
