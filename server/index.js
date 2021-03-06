const {ApolloServer, gql, PubSub} = require('apollo-server')
const config = require('../lib/config').buildUserConfig()

const pubsub = new PubSub()

const typeDefs = gql`
  type Book {
    title: String
    author: String
  }

  type Query {
    books: [Book]
  }
  
  type Mutation {
    mutation1(postId: Int): Int
    mutation2(postId: Int): Int
  }
  
  type Subscription {
    subscription1: Book
  }
`;

const books = [
  {
    title: 'The Awakening',
    author: 'Kate Chopin',
  },
  {
    title: 'City of Glass',
    author: 'Paul Auster',
  },
];

let intervalId
const resolvers = {
  Query: {
    books: () => books,
  },
  Mutation: {
    mutation1: (root, args, context) => {
      let count = 0
      intervalId = setInterval(() => {
        count++
        console.log('count', count)
        pubsub.publish('subscription1', {
          subscription1: {
            title: 'Tyler Rules ' + count,
            author: 'T$',
          }
        })
      }, 3000)
      return 7
    },
    mutation2: () => {
      clearInterval(intervalId)
    },
  },
  Subscription: {
    subscription1: {
      subscribe: () => {
        console.log('subscription thing is happening!')
        return pubsub.asyncIterator(['subscription1'])
      },
      unsubscribe: () => {
        console.log('unsubscribed!')
      },
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // The only way I knew to use subscriptions here was from:
  // https://github.com/apollographql/apollo-server/issues/1534#issuecomment-413179501
  subscriptions: {
    path: '/subscriptions',
    onConnect: async (connectionParams, webSocket) => {
      console.log('subscription onConnect')
    },
  },
});

server.listen(config.server.port).then(({url}) => {
  console.log(`🚀 Server ready at ${url}`);
});
