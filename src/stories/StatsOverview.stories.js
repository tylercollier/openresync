import StatsOverview from '../components/StatsOverview'
import { makeStory } from './lib/utils'
import { syncSourceDataSet1 } from '../../tests/fixtures/syncStats'

export default {
  title: 'StatsOverview',
  component: StatsOverview,
}

const localMakeStory = args => makeStory(Template, args)

const Template = (args, { argTypes, loaded }) => {
  console.log('loaded', loaded)
  return {
    props: Object.keys(argTypes),
    components: {StatsOverview},
    template:
      '<StatsOverview v-bind="$props" />',
  }
}

export const NoData = localMakeStory({
  stats: []
})
// NoData.loaders = [
//   async () => {
//     console.log('im here')
//     return {
//       x: await new Promise(resolve => setTimeout(resolve('hello'), 2000)),
//     }
//   },
// ]

export const SomeData = localMakeStory({
  stats: syncSourceDataSet1.reverse(),
})
