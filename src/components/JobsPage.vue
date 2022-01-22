<template>
  <FetchSubscribeRunningJobs v-slot="{ runningJobs }">
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
  </FetchSubscribeRunningJobs>
</template>

<script>
import FetchSubscribeRunningJobs from './FetchSubscribeRunningJobs'

export default {
  components: {
    FetchSubscribeRunningJobs,
  },
}
</script>
