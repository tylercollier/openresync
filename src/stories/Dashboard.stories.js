import Dashboard from '../components/Dashboard'
import { makeStory } from './lib/utils'

export default {
  title: 'Dashboard',
  component: Dashboard,
}

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { Dashboard },
  template:
    '<Dashboard v-bind="$props" />',
})

export const Base = makeStory(Template, {})
