import StatsOverview from '../components/StatsOverview'
import { makeStory } from './lib/utils'
import { syncSourceDataSet1 } from '../../tests/fixtures/syncStats'
import merge from 'lodash/merge'

export default {
  title: 'StatsOverview',
  component: StatsOverview,
}

const localMakeStory = args => makeStory(Template, args)

const Template = (args, { argTypes, loaded }) => {
  merge(args, loaded)
  return {
    props: Object.keys(argTypes),
    components: {StatsOverview},
    template:
      `<StatsOverview v-bind="$props" />`,
  }
}

export const NoData = localMakeStory({
  stats: [],
  y: 9,
})
NoData.loaders = [
  async () => {
    // console.log('im here2')
    return {
      x: await new Promise(resolve => setTimeout(() => resolve({ name: 'tyler' }), 500)),
    }
  },
]

export const SomeData = localMakeStory({
  stats: syncSourceDataSet1.reverse(),
})
