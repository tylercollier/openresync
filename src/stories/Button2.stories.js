// I am using this as my test for https://github.com/storybookjs/storybook/discussions/12691#discussioncomment-759786

import Button from '../components/Button2'

export default {
  title: 'Button2',
  component: Button,
  argTypes: {
    default: {
      control: {
        type: 'text',
      },
    },
    hint: {
      control: {
        type: 'text',
      }
    }
  }
}

const Template = (args, { argTypes }) => {
  return {
    props: Object.keys(argTypes),
    components: { Button },
    template:
      `
      <Button @onClick="onClick" v-bind="$props">
        <template v-if="${'default' in args}" v-slot>${args.default}</template>
        <template v-if="${'hint' in args}" v-slot:hint>${args.hint}</template>
      </Button>
    `,
  }
}

export const Base = Template.bind({})
Base.args = {}

export const WithDefaultSlotContent = Template.bind({})
WithDefaultSlotContent.args = {
  default: `<strong>Go!</strong>`,
}

export const WithOptionalSlotContent = Template.bind({})
WithOptionalSlotContent.args = {
  hint: `<div style="color:red;">Hurry</div>`,
}
