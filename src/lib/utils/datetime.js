// import { parse } from 'date-fns'
// import { utcToZonedTime, zonedTimeToUtc, format, toDate } from 'date-fns-tz'
//
// const sortableFormatString = 'yyyy-MM-dd HH:mm:ss z'
//
// function formatDateTime(dateObj) {
//   const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
//   console.log('timeZone', timeZone)
//   const zonedTime = utcToZonedTime(dateObj, timeZone)
//   console.log('zonedTime', zonedTime)
//   const formattedString = format(zonedTime, sortableFormatString)
//   console.log('formattedString', formattedString)
//   return formattedString
// }
//
//
// export function getDisplayDatetime(dateObj) {
//   return formatDateTime(dateObj)
// }
//
// export function convertBatchIdToDate(batchId) {
//   const q = toDate(batchId);
//   console.log('q', q)
//
//   const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
//   const date = parse(batchId, "yyyy-MM-dd-'T'-HH-mm-ss-SSS'Z'", new Date())
//   console.log('date', date)
//   const utcTime = zonedTimeToUtc(date, timeZone)
//   console.log('utcTime', utcTime.toISOString())
//   return utcTime
// }

// export function convertBatchIdToDate(batchId) {
//
// }
