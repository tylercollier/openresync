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
        num_records_updated_at: null,
        most_recent_at: null,
        destinations: [
          {
            name: 'destination1',
            num_records: 0,
            most_recent_at: null,
            num_recent_records: 0,
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
        num_records_updated_at: someTimestamp,
        most_recent_at: someTimestamp,
        destinations: [
          {
            name: 'destination1',
            num_records: 123456,
            most_recent_at: someTimestamp,
            num_recent_records: 987,
          },
          {
            name: 'destination2',
            num_records: 123456,
            most_recent_at: someTimestamp,
            num_recent_records: 987,
          },
        ],
      },
      {
        name: 'Member',
        num_records_in_mls: 98765,
        num_records_updated_at: someTimestamp,
        most_recent_at: someTimestamp,
        destinations: [
          {
            name: 'destination1',
            num_records: 98765,
            most_recent_at: someTimestamp,
            num_recent_records: 120,
          },
          {
            name: 'destination2',
            num_records: 98000,
            most_recent_at: someTimestamp.clone().subtract(1, 'day'),
            num_recent_records: 100,
          },
        ],
      },
    ],
  },
})

