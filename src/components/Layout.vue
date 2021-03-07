<template>
  <div>
    <HeaderContainer :source-name="sourceName" />
    <router-view></router-view>
  </div>
</template>

<script>
import HeaderContainer from './HeaderContainer'

export default {
  props: {
    sourceName: String,
  },
  components: {
    HeaderContainer,
  },
}
</script>
