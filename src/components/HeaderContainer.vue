<template>
  <div>
    <ApolloQuery
      :query="gql => gql`
        query UserConfig ($name: String) {
          userConfig (name: $name) {
            sources {
              name
            }
          }
        }
      `"
      :variables="{ name }"
    >
      <template v-slot="{ result: { loading, error, data } }">
        <div v-if="loading">Loading...</div>
        <!-- Error -->
        <div v-else-if="error" class="error apollo">An error occurred</div>

        <!-- Result -->
        <div v-else-if="data">
          <Header :sources="data.userConfig.sources"/>
        </div>

        <!-- No result -->
        <div v-else class="no-result apollo">No result :(</div>
      </template>
    </ApolloQuery>
  </div>
</template>

<script>
import Header from './Header'

export default {
  data() {
    return {
      name: 'tyler',
    }
  },
  components: {
    Header,
  },
}
</script>