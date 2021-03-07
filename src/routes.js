import VueRouter from 'vue-router'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Source from './components/Source'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '', component: Layout, props: true, children: [
    { path: '/dashboard', component: Dashboard },
    { path: '/sources/:sourceName', component: Source, props: true },
  ]},
]

export default new VueRouter({
  routes,
})