const {ApolloServer, gql, PubSub} = require('apollo-server')
const { createServer } = require('http')
const { SubscriptionServer } = require('subscriptions-transport-ws')
const { execute, subscribe } = require('graphql')
const { makeExecutableSchema } = require('@graphql-tools/schema')

const pubsub = new PubSub()

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    title: String
    author: String
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    books: [Book]
  }
  
  type Mutation {
    mutation1(postId: Int): Int
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

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    books: () => books,
  },
  Mutation: {
    mutation1: (root, args, context) => {
      console.log('mutation 1 args', args)
      let count = 0
      setInterval(() => {
        count++
        pubsub.publish('subscription1', {
          subscription1: {
            title: 'Tyler Rules ' + count,
            author: 'T$',
          }
        })
      }, 3000)
      console.log('mutation 1 args', args)
      return 7
    },
  },
  Subscription: {
    subscription1: {
      subscribe: () => {
        console.log('subscription thing is happening!')
        return pubsub.asyncIterator(['subscription1'])
      },
    },
  },
};

// The ApolloServer constructor requires two parameters: your schema
// definition and your set of resolvers.
const server = new ApolloServer({
  typeDefs,
  resolvers,
  uploads: false,
  subscriptions: {
    path: '/subscriptions',
    onConnect: async (connectionParams, webSocket) => {
      console.log('subscription onConnect')
    },
  },
});

// The `listen` method launches a web server.
server.listen().then(({url}) => {
  console.log(`🚀  Server ready at ${url}`);
});

// const schema = makeExecutableSchema({
//   typeDefs,
//   resolvers,
// })
//
// // Wrap the Express server
// const ws = createServer(server);
// ws.listen(4000, () => {
//   console.log(`Apollo Server is now running on http://localhost:${4000}`);
//   // Set up the WebSocket for handling GraphQL subscriptions
//   new SubscriptionServer({
//     execute,
//     subscribe,
//     schema,
//   }, {
//     server: ws,
//     path: '/subscriptions',
//   });
// });