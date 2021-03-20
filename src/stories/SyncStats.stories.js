import SyncStats from '../components/SyncStats'
import { makeStory } from './lib/utils'
import { syncSourceDataSet1 } from '../../tests/fixtures/syncStats'

export default {
  title: 'SyncStats',
  component: SyncStats,
}

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { SyncStats },
  template:
    '<SyncStats v-bind="$props" />',
})

export const NoData = makeStory(Template, {
  stats: []
})

export const SomeData = makeStory(Template, {
  stats: syncSourceDataSet1.reverse(),
})
