<template>
  <div>
    <div v-for="resource of stats" :key="resource.name">
      <h3>{{resource.name}}</h3>
      <b-table-simple small striped hover>
        <thead>
        <tr>
          <th>Source</th>
          <th>Destination</th>
          <th>Num records</th>
          <th>Most recent</th>
        </tr>
        </thead>
        <tbody>
        <tr class="tw-italic">
          <td>MLS</td>
          <td></td>
          <td>{{numRecordsInMls(resource.num_records_in_mls)}}</td>
          <td><display-datetime :datetime="resource.most_recent_at" /></td>
        </tr>
        <tr v-for="destination of resource.destinations" :key="destination.name">
          <td></td>
          <td>{{destination.name}}</td>
          <td>
            {{destination.num_records}}
            <span v-if="destination.num_records !== resource.num_records_in_mls">
              <b-icon class="tw-mx-2" icon="x-circle"
                      variant="danger" title="Does not match the number of records in the MLS"></b-icon>
              {{differenceString(destination.num_records, resource.num_records_in_mls)}}
            </span>
          </td>
          <td>
            <display-datetime :datetime="destination.most_recent_at" />
            <b-icon v-if="destination.most_recent_at && destination.most_recent_at != resource.most_recent_at" class="tw-ml-2" icon="x-circle" variant="danger" title="Does not match the most recent record in the MLS"></b-icon>
          </td>
        </tr>
        </tbody>
      </b-table-simple>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    stats: Array,
  },
  methods: {
    numRecordsInMls(num) {
      return num || '?'
    },
    differenceString(destinationNumRecords, numRecordsInMls) {
      if (!numRecordsInMls) {
        return ''
      }
      if (destinationNumRecords < numRecordsInMls) {
        return `Missing ${numRecordsInMls - destinationNumRecords}`
      }
      return `Too many by ${destinationNumRecords - numRecordsInMls}`
    },
  }
}
</script>
