<template>
  <div>
    <div class="tw-flex">
      <div>
        <b-button :disabled="isDisabled()" @click="startJob('sync')" size="sm" variant="outline-primary">
          Sync
          <b-spinner v-if="sync.running" small/>
          <b-icon v-else icon="arrow-right"/>
        </b-button>
      </div>
      <div class="tw-ml-4">
        <b-button :disabled="isDisabled()" @click="startJob('purge')" size="sm" variant="outline-primary">
          Purge
          <b-spinner v-if="purge.running" small/>
          <b-icon v-else icon="arrow-right"/>
        </b-button>
      </div>
      <div class="tw-ml-4">
        <b-button :disabled="isDisabled()" @click="startJob('reconcile')" size="sm" variant="outline-primary">
          Reconcile
          <b-spinner v-if="reconcile.running" small/>
          <b-icon v-else icon="arrow-right"/>
        </b-button>
      </div>
    </div>
    <div v-if="isDisabled()" class="tw-text-gray-400 tw-mt-2 tw-gray-400">
      Starting a job is disabled while another job for the same source is running
    </div>
  </div>
</template>

<script>
import gql from 'graphql-tag'
import { areAnyJobsFromSourceRunning } from '../../lib/sync/utils/jobs'

export default {
  props: {
    sourceName: String,
  },
  apollo: {
    $subscribe: {
      runningJobs: {
        query: gql`subscription {
          runningJobs {
            sourceName
            type
            startedAt
          }
        }`,
        result({ data }) {
          this.runningJobs = data.runningJobs
        },
      },
    },
  },
  data() {
    return {
      runningJobs: [],
      sync: {
        running: false,
      },
      purge: {
        running: false,
      },
      reconcile: {
        running: false,
      },
    }
  },
  methods: {
    startJob(type) {
      this[type].running = true
      const job = {
        sourceName: this.sourceName,
        type,
      }
      // We'll use two timers so the user sees a spinner for at least 500 ms, so they see the spinner for at least that
      // long, giving them feedback that they clicked the button and it did something.
      const minWaitTimePromise = new Promise(resolve => setTimeout(resolve, 500))
      const mutationPromise = this.$apollo.mutate({
        mutation: gql`mutation ($job: JobInput!) {
					startJob(job: $job)
				}`,
        variables: {
          job,
        },
      })
        .catch(error => {
          this.$bvToast.toast(error.message, {
            title: `Error starting ${type} job for ${job.sourceName}`,
            variant: 'danger',
            solid: true,
          })
        })
      Promise.all([minWaitTimePromise, mutationPromise]).then(() => {
        this[type].running = false
      })
    },
    isDisabled() {
      // This is a rudimentary way of not allowing colliding jobs for now. Eventually we'll want something more robust,
      // most importantly allowing the user to override.
      return areAnyJobsFromSourceRunning(this.runningJobs, this.sourceName)
    },
  },
}
</script>
