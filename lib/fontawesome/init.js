import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

library.add(faArrowRight)
library.add(faCheck)
library.add(faSpinner)

Vue.component('font-awesome-icon', FontAwesomeIcon)

