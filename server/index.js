const {ApolloServer, gql, PubSub} = require('apollo-server')
const config = require('../lib/config').buildUserConfig()

const pubsub = new PubSub()

const typeDefs = gql`
  type Source {
    name: String!
  }
  
  type UserConfig {
    sources: [Source!]!
  }

  type Query {
    userConfig(name: String): UserConfig
  }
`;

const resolvers = {
  Query: {
    userConfig: () => {
      return {
        sources: [{
          name: 'source1',
        }, {
          name: 'source2',
        }],
      }
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
      // console.log('subscription onConnect')
    },
  },
});

server.listen(config.server.port).then(({url}) => {
  console.log(`🚀 Server ready at ${url}`);
});
