<template>
  <div>
    <div>Stats overview</div>
    <div>x: {{x}}</div>
    <div>y: {{y}}</div>
    <div>z: {{z}}</div>
  </div>
</template>

<script>
export default {
  props: {
    stats: Array,
    x: Object,
    y: Number,
    z: String,
  },
}
</script>
