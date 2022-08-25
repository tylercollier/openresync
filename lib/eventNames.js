// These were originally in downloader.js (and other files) but caused this error when running the server:
//   TypeError: getMlsSourceUserConfig is not a function
// Turns out it was because the circular dependency, where downloader.js was (ultimately) require'ing the user config,
// which was require'ing downloader.js to import the constants.
// Circular dependencies are "allowed" in node, but the following makes sense why it would cause this behavior.
// https://nodejs.org/api/modules.html#modules_cycles
// > When main.js loads a.js, then a.js in turn loads b.js. At that point, b.js tries to load a.js. In order to prevent
// > an infinite loop, an unfinished copy of the a.js exports object is returned to the b.js module. b.js then finishes
// > loading, and its exports object is provided to the a.js module.
// See: https://stackoverflow.com/a/54176201/135101

const ORS_DOWNLOADER_DOWNLOAD_METADATA_ERROR = 'ors:downloader.download_metadata.error'
const ORS_DOWNLOADER_DOWNLOAD_SYNC_ERROR = 'ors:downloader.download_sync.error'
const ORS_DOWNLOADER_DOWNLOAD_PURGE_ERROR = 'ors:downloader.download_purge.error'
const ORS_DOWNLOADER_DOWNLOAD_RECONCILE_ERROR = 'ors:downloader.download_reconcile.error'
const ORS_DOWNLOADER_DOWNLOAD_MISSING_ERROR = 'ors:downloader.download_missing.error'

const ORS_SYNC_START = 'ors:sync.start'
const ORS_SYNC_DONE = 'ors:sync.done'
const ORS_SYNC_ERROR = 'ors:sync.error'
const ORS_SYNC_RESOURCE_START = 'ors:sync.resource.start'
const ORS_SYNC_RESOURCE_DONE = 'ors:sync.resource.done'
const ORS_SYNC_DESTINATION_PAGE = 'ors:sync.destination.page'

const ORS_PURGE_START = 'ors:purge.start'
const ORS_PURGE_DONE = 'ors:purge.done'
const ORS_PURGE_ERROR = 'ors:purge.error'
const ORS_PURGE_RESOURCE_START = 'ors:purge.resource.start'
const ORS_PURGE_RESOURCE_DONE = 'ors:purge.resource.done'
const ORS_PURGE_DESTINATION_PAGE = 'ors:purge.destination.page'

const ORS_RECONCILE_START = 'ors:reconcile.start'
const ORS_RECONCILE_DONE = 'ors:reconcile.done'
const ORS_RECONCILE_ERROR = 'ors:reconcile.error'
const ORS_RECONCILE_RESOURCE_START = 'ors:reconcile.resource.start'
const ORS_RECONCILE_RESOURCE_DONE = 'ors:reconcile.resource.done'
const ORS_RECONCILE_DESTINATION_PAGE = 'ors:reconcile.destination.page'

module.exports = {
  ORS_DOWNLOADER_DOWNLOAD_METADATA_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_SYNC_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_PURGE_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_RECONCILE_ERROR,
  ORS_DOWNLOADER_DOWNLOAD_MISSING_ERROR,

  ORS_SYNC_START,
  ORS_SYNC_DONE,
  ORS_SYNC_ERROR,
  ORS_SYNC_RESOURCE_START,
  ORS_SYNC_RESOURCE_DONE,
  ORS_SYNC_DESTINATION_PAGE,

  ORS_PURGE_START,
  ORS_PURGE_DONE,
  ORS_PURGE_ERROR,
  ORS_PURGE_RESOURCE_START,
  ORS_PURGE_RESOURCE_DONE,
  ORS_PURGE_DESTINATION_PAGE,

  ORS_RECONCILE_START,
  ORS_RECONCILE_DONE,
  ORS_RECONCILE_ERROR,
  ORS_RECONCILE_RESOURCE_START,
  ORS_RECONCILE_RESOURCE_DONE,
  ORS_RECONCILE_DESTINATION_PAGE,
}
