<template>
  <query-loader
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
  </query-loader>
</template>

<script>
import gql from 'graphql-tag'

// This file is named FetchSubscribe... to try to make it clear that it's going to initially fetch the data, but also
// subscribe to updates over time.
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
}
</script>
