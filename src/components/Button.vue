<template>
  <button v-on="$listeners" class="border py-2 px-4 rounded-md" :class="classes">
    <font-awesome-icon v-if="spinner && iconPosition === 'left'" icon="spinner" spin></font-awesome-icon>
    <slot name="icon" v-if="!spinner && icon && iconPosition === 'left'">
      <font-awesome-icon :icon="icon"></font-awesome-icon>
    </slot>
    <slot>
      Submit
    </slot>
    <font-awesome-icon v-if="spinner && iconPosition === 'right'" icon="spinner" spin></font-awesome-icon>
    <slot name="icon" v-if="!spinner && icon && iconPosition === 'right'">
      <font-awesome-icon :icon="icon"></font-awesome-icon>
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
        return 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white border-white'
      } else {
        return 'border-gray-800 hover:bg-gray-200 active:bg-gray-300'
      }
    },
  },
}
</script>
