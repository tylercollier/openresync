<template>
  <div>
    <h1>Jobs</h1>
    <jobs-consumer v-slot="{ runningJobs }">
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
          <td>
            <router-link :to="`/sources/${job.sourceName}`" style="color: #388dc0;">{{job.sourceName}}</router-link>
          <td>{{job.type}}</td>
          <td>
            <display-datetime :datetime="job.startedAt" />
          </td>
        </tr>
        </tbody>
      </b-table-simple>
    </jobs-consumer>
  </div>
</template>

<script>
export default {
}
</script>
