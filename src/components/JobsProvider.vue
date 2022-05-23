<template>
  <span>
    <slot />
  </span>
</template>

<script>
import gql from 'graphql-tag'

// The main idea is that this component provides info about running jobs to descendants in a reactive way. It does an
// apollo query for running jobs, as well as subscribes to updates for running jobs. So it will initially be in a
// loading state, and fetch the running jobs. However, whenever data from the subscription comes in that will be used.
// We use GraphQL query aliases to keep the two sets of runningJob GraphQL queries straight.
//
// Reminder: to accomplish the reactive nature of the provider, we use the vue-reactive-provide library.
export default {
  data() {
    return {
      error: null,
      fetchJobs: [],
      subscribeJobs: null,
    }
  },
  reactiveProvide: {
    name: 'jobsProvider',
    include: ['loading', 'error', 'runningJobs']
  },
  apollo: {
    fetchJobs: {
      query: gql`query RunningJobs {
        fetchJobs: runningJobs {
          sourceName
          type
          startedAt
        }
      }`,
      error(error) {
        this.error = error
      },
    },
    $subscribe: {
      subscribeJobs: {
        query: gql`subscription {
          subscribeJobs: runningJobs {
            sourceName
            type
            startedAt
          }
        }`,
        result({ data }) {
          this.subscribeJobs = data.subscribeJobs
        },
      },
    },
  },
  computed: {
    loading() {
      if (this.subscribeJobs || this.error) {
        return false
      }
      return this.$apollo.queries.fetchJobs.loading
    },
    runningJobs() {
      return this.subscribeJobs || this.fetchJobs
    },
  },
}
</script>
