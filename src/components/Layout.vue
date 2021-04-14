<template>
  <div>
    <Header />
    <div class="tw-flex">
      <div class="tw-w-64 tw-p-5" style="background: #c4ddec;">
        <FetchSources v-slot="{ sources }">
          <SourcesList :sources="sources" />
        </FetchSources>
      </div>
      <router-view class="tw-flex-1 tw-px-12 tw-pt-4"></router-view>
    </div>
  </div>
</template>

<script>
import FetchSources from './FetchSources'
import Header from './Header'
import SourcesList from './SourcesList'

export default {
  props: {
    sourceName: String,
  },
  components: {
    FetchSources,
    Header,
    SourcesList,
  },
}
</script>
