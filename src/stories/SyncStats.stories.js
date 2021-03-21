import SyncStats from '../components/SyncStats'
import { makeStory } from './lib/utils'
import { syncSourceDataSet1 } from '../../tests/fixtures/syncStats'

const localMakeStory = args => makeStory(Template, args)

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

export const NoData = localMakeStory({
  stats: []
})

export const SomeData = localMakeStory( {
  stats: syncSourceDataSet1.reverse(),
})
