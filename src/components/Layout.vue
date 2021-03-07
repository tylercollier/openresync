<template>
  <div>
    <HeaderContainer />
    <router-view></router-view>
  </div>
</template>

<script>
import HeaderContainer from './HeaderContainer'

export default {
  components: {
    HeaderContainer,
  },
}
</script>
