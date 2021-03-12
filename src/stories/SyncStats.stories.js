import SyncStats from '../components/SyncStats'
import { makeStory } from './lib/utils'

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

const myMlsSource = [
  {
    "id": 1,
    "name": "myMlsSource",
    "batch_id": "2021-02-18-T-06-24-07-623Z",
    "result": "success",
    "error": null,
    "created_at": "2021-03-09T06:54:59.000Z",
    "updated_at": "2021-03-09T06:54:59.000Z",
    "resources": [
      {
        "id": 2,
        "sync_sources_id": 1,
        "name": "Member",
        "is_done": 1,
        "created_at": "2021-03-09T06:54:59.000Z",
        "updated_at": "2021-03-09T06:54:59.000Z",
        "destinations": [
          {
            "id": 3,
            "sync_resources_id": 2,
            "name": "my_destination",
            "num_records_synced": 1,
            "created_at": "2021-03-09T06:54:59.000Z",
            "updated_at": "2021-03-09T06:54:59.000Z"
          }
        ]
      },
      {
        "id": 1,
        "sync_sources_id": 1,
        "name": "Property",
        "is_done": 1,
        "created_at": "2021-03-09T06:54:59.000Z",
        "updated_at": "2021-03-09T06:54:59.000Z",
        "destinations": [
          {
            "id": 1,
            "sync_resources_id": 1,
            "name": "my_destination",
            "num_records_synced": 2,
            "created_at": "2021-03-09T06:54:59.000Z",
            "updated_at": "2021-03-09T06:54:59.000Z"
          }
        ]
      }
    ]
  }
]

export const NoData = makeStory(Template, {
  historyStats: []
})

export const SomeData = makeStory(Template, {
  historyStats: [{
    name: 'myMlsSource',
    history: myMlsSource,
  }],
})
