const key = 'settings'

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
