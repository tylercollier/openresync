<template>
  <div>
    <h1>Source title here</h1>
    <div>Show the same SyncStats table here</div>
    <div>
      <div v-for="resource of stats.resources" :key="resource.name">
        <h2>{{resource.name}}</h2>
        <div>Records in resource in MLS: {{numRecordsInMls(resource.num_records_in_mls)}}</div>
        <div>MLS last queried: <display-datetime :datetime="resource.num_records_updated_at" /></div>
        <div>Most recent record: <display-datetime :datetime="resource.most_recent_at" /></div>
        <div v-for="destination of resource.destinations" :key="destination.name" class="tw-ml-4">
          <h3>{{destination.name}}</h3>
          <div>
            Num records: {{destination.num_records}}
            <b-icon v-if="destination.num_records !== resource.num_records_in_mls" icon="x-circle" variant="danger" title="Does not match the number of records in the MLS"></b-icon>
          </div>
          <div>
            Most recent timestamp: <display-datetime :datetime="destination.most_recent_at" />
            <b-icon v-if="destination.most_recent_at && !destination.most_recent_at.isSame(resource.most_recent_at)" icon="x-circle" variant="danger" title="Does not match the most recent record in the MLS"></b-icon>
          </div>
          <div>Num records at most recent timestamp: {{destination.num_recent_records}}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    stats: Object,
  },
  methods: {
    numRecordsInMls(num) {
      return num ? num : '?'
    },
  }
}
</script>