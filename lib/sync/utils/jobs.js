function areAnyJobsFromSourceRunning(runningJobs, sourceName) {
  return !!runningJobs.find(x => x.sourceName === sourceName)
}

module.exports = {
  areAnyJobsFromSourceRunning,
}
