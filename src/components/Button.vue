<template>
  <button v-on="$listeners" class="tw-border tw-py-2 tw-px-4 tw-rounded-md" :class="classes">
    <b-spinner v-if="spinner && iconPosition === 'left'" small></b-spinner>
    <slot name="icon" v-if="!spinner && icon && iconPosition === 'left'">
      <b-icon :icon="icon"></b-icon>
    </slot>
    <slot>
      Submit
    </slot>
    <b-spinner v-if="spinner && iconPosition === 'right'" small></b-spinner>
    <slot name="icon" v-if="!spinner && icon && iconPosition === 'right'">
      <b-icon :icon="icon"></b-icon>
    </slot>
  </button>
</template>

<script>
export default {
  props: {
    icon: [String, Array],
    iconPosition: {
      type: String,
      default: 'left',
    },
    primary: {
      type: Boolean,
      default: false,
    },
    spinner: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    classes() {
      if (this.primary) {
        return 'tw-bg-blue-500 hover:tw-bg-blue-600 active:tw-bg-blue-700 tw-text-white tw-border-white'
      } else {
        return 'tw-border-gray-800 hover:tw-bg-gray-200 active:tw-bg-gray-300'
      }
    },
  },
}
</script>
