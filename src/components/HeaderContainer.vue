<template>
  <div>
    <ApolloQuery
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
      <template v-slot="{ result: { loading, error, data } }">
        <div v-if="loading">Loading...</div>
        <div v-else-if="error" class="error apollo">An error occurred</div>
        <div v-else-if="data">
          <Header :sources="data.userConfig.sources" :source-name="sourceName"/>
        </div>
        <div v-else class="no-result apollo">No result :(</div>
      </template>
    </ApolloQuery>
  </div>
</template>

<script>
import Header from './Header'

export default {
  props: {
    sourceName: String,
  },
  components: {
    Header,
  },
}
</script>