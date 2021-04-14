<template>
  <div class="g">
    <div><span class="tw-font-bold">Next sync:</span></div>
    <div class="ml-2">
      <DisplayDatetime style="color: #388dbf;" v-if="schedules.length && schedules[0].sync" :datetime="schedules[0].sync.nextDate"/>
    </div>
    <div><span class="tw-font-bold">Sync schedule:</span></div>
    <div class="ml-2">
      <div v-if="schedules.length && schedules[0].sync">
        <code style="color: #388dbf;">{{schedules[0].sync.cronString}}</code>
      </div>
    </div>
    <div><span class="tw-font-bold">Next purge:</span></div>
    <div class="ml-2">
      <DisplayDatetime style="color: #388dbf;" v-if="schedules.length && schedules[0].purge" :datetime="schedules[0].purge.nextDate"/>
    </div>
    <div><span class="tw-font-bold">Purge schedule:</span></div>
    <div class="ml-2">
      <div v-if="schedules.length && schedules[0].purge">
        <code style="color: #388dbf;">{{schedules[0].purge.cronString}}</code>
      </div>
    </div>
  </div>
</template>

<script>
import DisplayDatetime from './DisplayDatetime'

export default {
  props: {
    schedules: Object,
  },
  components: {
    DisplayDatetime,
  },
}
</script>

<style type="scss" scoped>
.g {
  display: inline-grid;
  grid-template-columns: repeat(4, auto);
  grid-column-gap: 4px;
}

.g :nth-child(3), .g :nth-child(7) {
  margin-left: 40px;
}

code {
  color: black;
}
</style>
