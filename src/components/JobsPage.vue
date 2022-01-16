<template>
  <div>
    <h1>Jobs</h1>
    <b-table-simple>
      <thead>
      <tr>
        <th>Source</th>
        <th>Process Type</th>
        <th>Started At</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(job, index) of runningJobs" :key="index">
        <td>{{job.sourceName}}</td>
        <td>{{job.type}}</td>
        <td>
          <display-datetime :datetime="job.startedAt" />
        </td>
      </tr>
      </tbody>
    </b-table-simple>
    <FetchSources v-slot="{ sources }">
      <div v-for="source of sources" :key="source.name">
        <div v-for="type of ['sync', 'purge', 'reconcile']" :key="type">
          {{source.name}} {{type}} -
          <b-button @click="startJob(source.name, type)" size="sm">Start job</b-button>
        </div>
      </div>
    </FetchSources>
  </div>
</template>

<script>
import gql from 'graphql-tag'
import FetchSources from './FetchSources'

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
  methods: {
    startJob(sourceName, type) {
      const job = {
        sourceName,
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
    },
  },
  components: {
    FetchSources,
  },
}
</script>
