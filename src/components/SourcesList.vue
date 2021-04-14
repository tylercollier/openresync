<template>
  <div>
    <div class="tw-text-3xl tw-border-gray-700 tw-border-dotted tw-border-b-2 tw-mb-4">Sources</div>
    <div v-for="source of sources" :key="source.name">
      <router-link :to="`/sources/${source.name}`" :style="styles(`/sources/${source.name}`)" style="color: #388dc0;">{{source.name}}</router-link>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    sources: Array,
  },
  methods: {
    styles(routePath) {
      if (this.$route.path === routePath) {
        return {
          color: '#d78326',
        }
      }
      return {}
    },
  },
}
</script>
