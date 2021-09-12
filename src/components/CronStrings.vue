<template>
  <div>
    <div v-for="(cronString, i) of cronStrings" :key="i">
      <code style="color: #388dbf;">{{cronString}}</code>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    cronStrings: Array,
  },
}
</script>
