const { quote, expandUrl } = require('../utils')

function getItemsForMissingRecordsUsingInOperator({
  mlsResourceObj,
  top,
  urlMaxLength,
  missingIds,
  resourceEndpoint,
  primaryKey,
  shiftMissingIds,
}) {
  const u = new URL(resourceEndpoint)
  if (mlsResourceObj.expand) {
    u.searchParams.set('$expand', mlsResourceObj.expand.map(expandUrl).join(','))
  }
  u.searchParams.set('$top', top)
  const filterTemplate = `${primaryKey} in (PLACEHOLDER)`
  const filterTemplateLength = filterTemplate.replace('PLACEHOLDER', '').length
  // The -1 is for the ampersand
  const filterMaxLength = urlMaxLength - filterTemplateLength - u.toString().length - 1
  let filterString = ''
  let len = 0
  const firstId = missingIds[0]
  let lastId
  let recordsToDownloadCount = 0
  while (missingIds.length && recordsToDownloadCount < top) {
    const id = missingIds[0]
    const maybeComma = filterString ? ',' : ''
    const idFilterString = maybeComma + quote(id)
    const idFilterStringLength = fixedEncodeURIComponent(idFilterString).length
    if (len + idFilterStringLength <= filterMaxLength) {
      shiftMissingIds()
      filterString += idFilterString
      len += idFilterStringLength
      recordsToDownloadCount++
      lastId = id
    } else {
      break
    }
  }
  let filter = filterTemplate.replace('PLACEHOLDER', filterString)
  const originalFilter = u.searchParams.get('$filter')
  if (originalFilter) {
    filter = originalFilter + ' and ' + filter
  }
  u.searchParams.set('$filter', filter)
  return {
    url: u.toString(),
    firstId,
    lastId,
    recordsToDownloadCount,
  }
}

function getItemsForMissingRecordsUsingOrOperator({
  mlsResourceObj,
  top,
  urlMaxLength,
  missingIds,
  resourceEndpoint,
  primaryKey,
  shiftMissingIds,
  // TODO: Better than shouldQuote would be knowing what data type the primaryKey is.
  shouldQuote = true
}) {
  const u = new URL(resourceEndpoint)
  if (mlsResourceObj.expand) {
    u.searchParams.set('$expand', mlsResourceObj.expand.map(expandUrl).join(','))
  }
  u.searchParams.set('$top', top)
  // Hmm. Capitalized 'OR' makes RMLS error with message "Illegal value of '$filter' option!". I thought it should be
  // capitalized, but maybe not. I'm making a note because perhaps this is platform specific.
  const separator = ' or '
  // The -1 is for the ampersand
  const filterMaxLength = urlMaxLength - u.toString().length - 1
  let filterString = ''
  let len = 0
  const firstId = missingIds[0]
  let lastId
  let recordsToDownloadCount = 0
  while (missingIds.length && recordsToDownloadCount < top) {
    const id = missingIds[0]
    const maybeSeparator = filterString ? separator : ''
    const idFilterString = maybeSeparator + `${primaryKey} eq ${shouldQuote ? quote(id) : id}`
    const idFilterStringLength = fixedEncodeURIComponent(idFilterString).length
    if (len + idFilterStringLength <= filterMaxLength) {
      shiftMissingIds()
      filterString += idFilterString
      len += idFilterStringLength
      recordsToDownloadCount++
      lastId = id
    } else {
      break
    }
  }
  const originalFilter = u.searchParams.get('$filter')
  if (originalFilter) {
    filterString = originalFilter + ' and ' + filterString
  }
  u.searchParams.set('$filter', filterString)
  return {
    url: u.toString(),
    firstId,
    lastId,
    recordsToDownloadCount,
  }
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
// See: https://stackoverflow.com/a/62436468/135101
function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}

module.exports = {
  getItemsForMissingRecordsUsingInOperator,
  getItemsForMissingRecordsUsingOrOperator,
}
