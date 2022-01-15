<template>
  <!--
    I'm using fetch-policy="no-cache" here because setting it in main.js doesn't seem to do anything.

    Use notifyOneNetworkStatusChange so that 'loading' state still works when using fetch-policy="no-cache".
    See: https://github.com/vuejs/vue-apollo/issues/263#issuecomment-488686655
  -->
  <ApolloQuery ref="theQuery" v-bind="$attrs" fetch-policy="no-cache" notifyOnNetworkStatusChange>
    <template v-slot="{ result: { loading, error, data } }">
      <div v-if="loading">Loading...</div>
      <div v-else-if="error" class="error">An error occurred</div>
      <div v-else-if="data">
        <slot v-bind="{ data, refresh }">data: {{data}}</slot>
      </div>
      <div v-else></div>
    </template>
  </ApolloQuery>
</template>

<script>
export default {
  methods: {
    // Apollo's term is refetch. I'm using refresh to just not mix up.
    refresh() {
      // I got this from https://github.com/vuejs/apollo/issues/36#issuecomment-880664051
      this.$refs.theQuery.$_apollo.queries.query.refetch()
    },
  },
}
</script>
