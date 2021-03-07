<template>
  <div>
    <h1 class="text-4xl">Openresync</h1>
    <div>
      <div>Navigation</div>
      <div class="w-64 flex justify-around">
        <div class="mr-4">
          <router-link to="/dashboard">Dashboard</router-link>
        </div>
        <div v-for="source of sources" :key="source.name" class="mr-4">
          <router-link :to="`/sources/${source.name}`">{{source.name}}</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    sources: Array,
  },
  data() {
    console.log('this.sources', this.sources)
    return {
      
    }
  },
}
</script>
