<template>
  <div>
    <div v-for="(cronString, i) of cronStrings" :key="i">
      <code :style="getStyle()" :class="{ 'tw-text-gray-400': !enabled }">{{cronString}}</code>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    cronStrings: Array,
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  methods: {
    getStyle() {
      const style = {}
      if (this.enabled) {
        style.color = 'inherit';
      }
      return style
    },
  },
}
</script>
