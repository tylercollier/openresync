<template>
  <div>
    <h1>Jobs</h1>
    <b-table-simple small striped hover style="width: auto; min-width: 500px;">
      <thead>
      <tr>
        <th>Source</th>
        <th>Process Type</th>
        <th>Started At</th>
      </tr>
      </thead>
      <tbody>
      <tr v-if="runningJobs.length === 0">
        <td colspan="3">No jobs running</td>
      </tr>
      <tr v-for="(job, index) of runningJobs" :key="index">
        <td>{{job.sourceName}}</td>
        <td>{{job.type}}</td>
        <td>
          <display-datetime :datetime="job.startedAt" />
        </td>
      </tr>
      </tbody>
    </b-table-simple>
  </div>
</template>

<script>
import gql from 'graphql-tag'

export default {
  data() {
    return {
      runningJobs: [],
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
