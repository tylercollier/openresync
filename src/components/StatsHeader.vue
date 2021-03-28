<template>
  <div class="tw-flex tw-justify-between">
    <h2>{{ sourceName }}</h2>
    <div>
      <router-link :to="{ name: 'source', params: { sourceName: sourceName } }">View</router-link>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    sourceName: String,
  },
}
</script>
