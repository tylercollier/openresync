<template>
  <div>
    <h1 class="text-2xl">{{sourceName}}</h1>
    <div>some text</div>
  </div>
</template>

<script>
export default {
  props: {
    sourceName: String,
  },
}
</script>
