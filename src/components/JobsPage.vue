<template>
  <div v-if="!jobsProvider.loading">
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
      <tr v-if="jobsProvider.runningJobs.length === 0">
        <td colspan="3">No jobs running</td>
      </tr>
      <tr v-for="(job, index) of jobsProvider.runningJobs" :key="index">
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
export default {
  inject: ['jobsProvider'],
}
</script>
