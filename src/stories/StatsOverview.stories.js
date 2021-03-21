import StatsOverview from '../components/StatsOverview'
import StatsOverviewWrapper from '../components/StatsOverviewWrapper'
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
    data() {
      return {
        loaded,
      }
    },
    beforeMount() {
      // console.log('this.$props', this.$props)
      // console.log('this.$data', this.$data)
      // this.tyler = loaded
    },
    template:
      `<StatsOverview v-bind="$props" :x="loaded.x" />`,
  }
}
// const Template = (args, { argTypes, loaded }) => {
//   return StatsOverviewWrapper
// }

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
