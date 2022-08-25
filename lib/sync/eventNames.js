// These were originally in downloader.js but caused this error when running the server:
//   TypeError: getMlsSourceUserConfig is not a function
// Turns out it was because the circular dependency, where downloader.js was (ultimately) require'ing the user config,
// which was require'ing downloader.js to import the constants.
// This is a known thing, see: https://stackoverflow.com/questions/64713565

const ORS_DOWNLOADER_DOWNLOAD_METADATA_ERROR = 'ors:downloader.download_metadata.error'
const ORS_DOWNLOADER_DOWNLOAD_SYNC_ERROR = 'ors:downloader.download_sync.error'
const ORS_DOWNLOADER_DOWNLOAD_PURGE_ERROR = 'ors:downloader.download_purge.error'
const ORS_DOWNLOADER_DOWNLOAD_RECONCILE_ERROR = 'ors:downloader.download_reconcile.error'
const ORS_DOWNLOADER_DOWNLOAD_MISSING_ERROR = 'ors:downloader.download_missing.error'

module.exports = {
  ORS_DOWNLOADER_DOWNLOAD_METADATA_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_SYNC_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_PURGE_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_RECONCILE_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_MISSING_ERROR,
}
