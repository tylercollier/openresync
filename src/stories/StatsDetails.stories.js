import StatsDetails from '../components/StatsDetails'
import { makeStory } from './lib/utils'
import moment from 'moment'

const localMakeStory = (...rest) => makeStory(Template, ...rest)

export default {
  title: 'StatsDetails',
  component: StatsDetails,
}

const Template = (args, { argTypes }) => {
  return {
    props: Object.keys(argTypes),
    components: { StatsDetails },
    template:
      `
      <StatsDetails v-bind="$props">
      </StatsDetails>
    `,
  }
}

export const NeverRun = localMakeStory({
  stats: {
    resources: [
      {
        name: 'Property',
        num_records_in_mls: null,
        most_recent_at: null,
        destinations: [
          {
            name: 'destination1',
            num_records: 0,
            most_recent_at: null,
          },
        ],
      },
    ],
  },
})

const someTimestamp = moment.utc('2021-03-16T17:52:11Z')
export const Run = localMakeStory({
  stats: {
    resources: [
      {
        name: 'Property',
        num_records_in_mls: 123456,
        most_recent_at: someTimestamp,
        destinations: [
          {
            name: 'destination1',
            num_records: 123456,
            most_recent_at: someTimestamp,
          },
          {
            name: 'destination2',
            num_records: 123456,
            most_recent_at: someTimestamp,
          },
        ],
      },
      {
        name: 'Member',
        num_records_in_mls: 98765,
        most_recent_at: someTimestamp,
        destinations: [
          {
            name: 'destination1',
            num_records: 98765,
            most_recent_at: someTimestamp,
          },
          {
            name: 'destination2',
            num_records: 98000,
            most_recent_at: someTimestamp.clone().subtract(1, 'day'),
          },
        ],
      },
    ],
  },
})

