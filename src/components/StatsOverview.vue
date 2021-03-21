<template>
  <div>
    <div>Stats overview</div>
    <div>x: {{x}}</div>
    <div>y: {{y}}</div>
  </div>
</template>

<script>
export default {
  props: {
    stats: Array,
    x: Object,
    y: Number,
  },
}
</script>
