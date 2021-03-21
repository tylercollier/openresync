import SyncStats from '../components/SyncStats'
import { makeStory } from './lib/utils'
import { syncSourceDataSet1 } from '../../tests/fixtures/syncStats'
import axios from 'axios'
import merge from 'lodash/merge'

const localMakeStory = (...rest) => makeStory(Template, ...rest)

export default {
  title: 'SyncStats',
  component: SyncStats,
}

const Template = (args, { argTypes, loaded }) => {
  merge(args, loaded)
  return {
    props: Object.keys(argTypes),
    components: { SyncStats },
    template:
      '<SyncStats v-bind="$props" />',
  }
}

export const NoData = localMakeStory({
  stats: []
})

export const SomeData = localMakeStory(null, {
  loaders: [
    async () => ({
      stats: await axios({
        url: 'http://localhost:4001/qa/stats1',
      }).then(response => response.data),
    }),
  ],
})
