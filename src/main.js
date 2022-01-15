import Vue from 'vue'
import App from './App.vue'
import VueApollo from 'vue-apollo'
import VueRouter from 'vue-router'
import { ApolloClient } from 'apollo-client'
import { createHttpLink } from 'apollo-link-http'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { split } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { getMainDefinition } from 'apollo-utilities'
import { merge } from 'lodash'
import router from './routes'
import settings from './settings'
import './components/index'

import './assets/tailwind.css'
import './lib/bootstrap/init'
import './assets/index.scss'

const httpLink = createHttpLink()
const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
const wsLink = new WebSocketLink({
  uri: `${protocol}://${location.host}/subscriptions`,
  options: {
    reconnect: true,
  },
})
// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = split(
  // split based on operation type
  ({ query }) => {
    const definition = getMainDefinition(query)
    return definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
  },
  wsLink,
  httpLink
)
const cache = new InMemoryCache()
const apolloClient = new ApolloClient({
  link,
  cache,
  // no-cache stuff doesn't seem to take effect here. Why not? So, I'm forcing fetch-policy="no-cache" in QueryLoader.
  // defaultOptions: {
  //   watchQuery: {
  //     fetchPolicy: 'no-cache',
  //   },
  //   query: {
  //     fetchPolicy: 'no-cache',
  //   },
  // },
})
Vue.use(VueApollo)
const apolloProvider = new VueApollo({
  defaultClient: apolloClient,
})

Vue.use(VueRouter)

Vue.config.productionTip = false

const defaultSettings = {
  version: '0.0.1',
  useRelativeTime: false,
  cronPage: {
    orderByName: 'userConfig'
  }
}
const savedSettings = settings.getSettings()
const mergedSettings = merge(defaultSettings, savedSettings)
const globalStore = new Vue({
  data: mergedSettings,
  methods: {
    save() {
      const temp = Object.assign({}, globalStore.$data)
      // $apolloData must get added automatically somewhere. Remove it.
      delete temp.$apolloData
      settings.saveSettings(temp)
    },
  },
})
Vue.prototype.$globals = globalStore

new Vue({
  render: h => h(App),
  router,
  apolloProvider,
}).$mount('#app')
