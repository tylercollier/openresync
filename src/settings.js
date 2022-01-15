const key = 'openresync:settings'

function saveSettings(settings) {
  localStorage.setItem(key, JSON.stringify(settings))
}

function getSettings() {
  return JSON.parse(localStorage.getItem(key))
}

export default {
  saveSettings,
  getSettings,
}
