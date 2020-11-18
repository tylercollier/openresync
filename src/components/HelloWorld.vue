<template>
  <div>
    <h1>sup</h1>
    <div v-if="books">{{books}}</div>
    <div>
      <button @click="go">Mutate!</button>
    </div>
  </div>
</template>

<script>
import gql from 'graphql-tag'

export default {
  props: {
    msg: String
  },
  apollo: {
    $subscribe: {
      subscription1: {
        query: gql`subscription {
          subscription1 {
            title
            author
          }
        }`,
        result({ data }) {
          console.log('data', data)
        },
      },
    },
    books: gql`query {
      books {
        title
        author
      }
    }`,
  },
  methods: {
    go() {
      this.$apollo.mutate({
        mutation: gql`mutation ($postId: Int) {
          mutation1(postId: $postId)
        }`,
        variables: {
          postId: 99,
        },
      }).then(data => {
        console.log('data', data)
      }).catch(error => {
        console.log('error', error)
      })
    },
  },
}
</script>
