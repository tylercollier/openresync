<template>
  <div>
    <QueryLoader
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
    </QueryLoader>
  </div>
</template>

<script>
import QueryLoader from './QueryLoader'

export default {
  props: {
    sourceName: String,
  },
  components: {
    QueryLoader,
  },
}
</script>
