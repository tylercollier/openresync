const {ApolloServer, gql, PubSub} = require('apollo-server')

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

const resolvers = {
  Query: {
    books: () => books,
  },
  Mutation: {
    mutation1: (root, args, context) => {
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

// The `listen` method launches a web server.
server.listen().then(({url}) => {
  console.log(`🚀  Server ready at ${url}`);
});
