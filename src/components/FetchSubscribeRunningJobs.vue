<template>
  <QueryLoader
    :query="gql => gql`
        query RunningJobs {
          runningJobs {
            sourceName
            type
            startedAt
          }
        }
      `"
  >
    <template v-slot="{ data }">
      <slot :running-jobs="runningJobs || data.runningJobs"></slot>
    </template>
  </QueryLoader>
</template>

<script>
import gql from 'graphql-tag'
import QueryLoader from './QueryLoader'

export default {
  data() {
    return {
      runningJobs: null,
    }
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
  components: {
    QueryLoader,
  },
}
</script>
