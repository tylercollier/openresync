import Vue from 'vue'

import {
  BootstrapVue,
  TableSimplePlugin,
  IconsPlugin,
  TooltipPlugin,
} from 'bootstrap-vue'

// Import Bootstrap and BootstrapVue CSS files (order is important)
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import './bootstrap-overrides.css'

// Make BootstrapVue available throughout your project
Vue.use(BootstrapVue)
// Optionally install the BootstrapVue icon components plugin
Vue.use(IconsPlugin)
Vue.use(TableSimplePlugin)
Vue.use(TooltipPlugin)
