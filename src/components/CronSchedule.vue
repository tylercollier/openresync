<template>
  <div>
    <div>
      Next run: <DisplayDatetime :datetime="nextDate" />
    </div>
    <div>Cron: {{cronString}}</div>
  </div>
</template>

<script>
import DisplayDatetime from './DisplayDatetime'

export default {
  props: {
    cronString: String,
    nextDate: [Object, String],
  },
  components: {
    DisplayDatetime,
  },
}
</script>
