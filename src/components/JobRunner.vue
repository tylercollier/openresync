<template>
  <div class="tw-flex">
    <div>
      <b-button @click="go('sync')" size="sm" variant="outline-secondary">
        Sync
        <b-spinner v-if="sync.running" small />
        <b-icon v-else icon="arrow-right" />
      </b-button>
    </div>
    <div class="tw-ml-4">
      <b-button @click="go('purge')" size="sm" variant="outline-secondary">
        Purge
        <b-spinner v-if="purge.running" small />
        <b-icon v-else icon="arrow-right" />
      </b-button>
    </div>
    <div class="tw-ml-4">
      <b-button @click="go('reconcile')" size="sm" variant="outline-secondary">
        Reconcile
        <b-spinner v-if="reconcile.running" small />
        <b-icon v-else icon="arrow-right" />
      </b-button>
    </div>
  </div>
</template>

<script>
import gql from 'graphql-tag'

export default {
  props: {
    sourceName: String,
  },
  data() {
    return {
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
    go(type) {
      this[type].running = true
      const job = {
        sourceName: this.sourceName,
        type,
      }
      this.$apollo.mutate({
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
        .finally(() => {
          this[type].running = false
        })
    },
  },
}
</script>
