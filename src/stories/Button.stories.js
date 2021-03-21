import Button from '../components/Button'
import { makeStory } from './lib/utils'

const localMakeStory = args => makeStory(Template, args)

export default {
  title: 'Button',
  component: Button,
}

const Template = (args, { argTypes, loaded }) => {
  console.log('loaded', loaded)
  return {
    props: Object.keys(argTypes),
    components: { Button },
    template:
      `
      <Button v-bind="$props">
        <template v-if="${'default' in args}" v-slot>${args.default}</template>
      </Button>
    `,
  }
}

export const Base = localMakeStory({})

export const Words = localMakeStory({
  default: 'Click this button!',
})

export const MarkupContent = localMakeStory({
  default: `<div>hi</div><div>line 2</div>`
})

export const Icon = localMakeStory({
  icon: ['fa', 'check'],
})

export const Spinner = localMakeStory({
  spinner: true,
})

export const IconRight = localMakeStory({
  icon: 'arrow-right',
  iconPosition: 'right',
})

export const SpinnerRight = localMakeStory({
  iconPosition: 'right',
  spinner: true,
})

export const Primary = localMakeStory({
  primary: true,
})
