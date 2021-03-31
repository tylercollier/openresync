import VueRouter from 'vue-router'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Source from './components/Source'
import CronPage from './components/CronPage'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '', component: Layout, props: true, children: [
    { path: '/dashboard', component: Dashboard },
    { path: '/cron', component: CronPage },
    { path: '/sources/:sourceName', component: Source, props: true, name: 'source' },
  ]},
]

export default new VueRouter({
  routes,
})
