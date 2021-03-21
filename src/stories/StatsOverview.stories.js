import StatsOverview from '../components/StatsOverview'
import { makeStory } from './lib/utils'
import { syncSourceDataSet1 } from '../../tests/fixtures/syncStats'
import merge from 'lodash/merge'

export default {
  title: 'StatsOverview',
  component: StatsOverview,
}

const localMakeStory = (...rest) => makeStory(Template, ...rest)

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
})
