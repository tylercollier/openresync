import CronSchedule from '../components/CronSchedule'
import { makeStory } from './lib/utils'
import { CronJob } from 'cron'
import moment from 'moment'

const localMakeStory = args => makeStory(Template, args)

export default {
  title: 'CronSchedule',
  component: CronSchedule,
}

const Template = (args, { argTypes }) => {
  return {
    props: Object.keys(argTypes),
    components: { CronSchedule },
    template:
      `
      <CronSchedule v-bind="$props" />
    `,
  }
}

export const Base = localMakeStory({})

const job = new CronJob('0 0 * * * *', () => {
  logger.debug('Running job')
})
// job.start()
export const Words = localMakeStory({
  cronString: '*/15 * * * *',
  nextDate: moment.utc('2021-03-30T00:15:00Z'),
})
