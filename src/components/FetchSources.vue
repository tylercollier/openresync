<template>
  <query-loader
    :query="gql => gql`
      query UserConfig {
        userConfig {
          sources {
            name
          }
        }
      }
    `"
  >
    <template v-slot="{ data }">
      <slot :sources="data.userConfig.sources"></slot>
    </template>
  </query-loader>
</template>

<script>
export default {
  props: {
    sourceName: String,
  },
}
</script>
