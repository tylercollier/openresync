<template>
  <div class="tw-flex tw-justify-between tw-items-end tw-py-2 tw-px-4 tw-bg-blue-100">
    <h1 class="tw-text-4xl">Openresync</h1>
    <div class="tw-flex">
      <div class="tw-mr-4">
        <router-link to="/dashboard">Dashboard</router-link>
      </div>
      <VueSelect
        style="width: 250px"
        :options="sources"
        label="name"
        :value="selectedSource"
        @input="goToSource"
        :clearable="false"
        placeholder="MLS Source"
      />
    </div>
  </div>
</template>

<script>
import VueSelect from 'vue-select'

export default {
  props: {
    sources: Array,
    sourceName: String,
  },
  methods: {
    goToSource(value) {
      this.$router.push({ path: `/sources/${value.name}` })
    },
  },
  computed: {
    selectedSource() {
      return this.sources.find(x => x.name === this.sourceName)
    },
  },
  components: {
    VueSelect,
  },
}
</script>
