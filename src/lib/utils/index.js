import _get from 'lodash/get'
import _set from 'lodash/set'
import mapValues from 'lodash/mapValues'

function makeGlobalSetting(path) {
  return {
    get() {
      return _get(this.$globals.$data, path)
    },
    set(val) {
      _set(this.$globals.$data, path, val)
      this.$globals.save()
    },
  }
}

function makeGlobalSettings(namesAndPaths) {
  return  mapValues(namesAndPaths, makeGlobalSetting)
}

export {
  makeGlobalSetting,
  makeGlobalSettings,
}
