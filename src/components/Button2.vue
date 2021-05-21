<template>
  <button @click="$emit('onClick')">
    <slot>
      Submit
    </slot>
    <div style="font-size:x-small;color:gray;">
      <slot name="hint">
        Click me
      </slot>
    </div>
  </button>
</template>

<script>
// I am using this as my test for https://github.com/storybookjs/storybook/discussions/12691#discussioncomment-759786
export default {
}
</script>
