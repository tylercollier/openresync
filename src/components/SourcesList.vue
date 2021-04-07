<template>
  <div>
    <div class="mb-4">
      <router-link to="/dashboard">Dashboard</router-link>
    </div>
    <div>Sources</div>
    <div v-for="source of sources" :key="source.name">
      <router-link :to="`/sources/${source.name}`">{{source.name}}</router-link>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    sources: Array,
  },
}
</script>
