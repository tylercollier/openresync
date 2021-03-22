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
      <template v-slot="data">
        <Header :sources="data.userConfig.sources" :source-name="sourceName"/>
      </template>
    </QueryLoader>
  </div>
</template>

<script>
import Header from './Header'
import QueryLoader from './QueryLoader'

export default {
  props: {
    sourceName: String,
  },
  components: {
    Header,
    QueryLoader,
  },
}
</script>
