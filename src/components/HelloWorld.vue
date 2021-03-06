<template>
  <div>
    <h1 class="text-6xl">Open RE Sync</h1>
    <div v-if="books">{{books}}</div>
    <div class="flex">
      <button class="border border-black p-2 mr-2" @click="go">Start (sending values from server)!</button>
      <button class="border border-black p-2 mr-2" @click="stop">Stop (sending values on server)!</button>
      <button class="border border-black p-2 mr-2" @click="unsubscribe">Unsubscribe!</button>
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
    stop() {
      this.$apollo.mutate({
        mutation: gql`mutation ($postId: Int) {
          mutation2(postId: $postId)
        }`,
        variables: {
          postId: 99,
        },
      }).then(data => {
        console.log('data2', data)
      }).catch(error => {
        console.log('error2', error)
      })
    },
    unsubscribe() {
      console.log('this.$apollo.subscriptions.subscription1', this.$apollo.subscriptions.subscription1)
      // I guessed how to unsubscribe by looking through the __proto__ in the console.log
      const x = this.$apollo.subscriptions.subscription1.sub.unsubscribe()
      console.log('x', x)
    },
  },
}
</script>
