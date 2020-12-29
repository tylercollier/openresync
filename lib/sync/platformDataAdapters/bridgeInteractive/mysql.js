module.exports = function() {
  function getDatabaseType(property) {
    const type = property.$.Type;
    if (type.match(/Collection\(.*Enums\)/) || type.match(/.*Enums\./)) {
      return 'TEXT'
    } else if (type.match(/Collection.*ComplexTypes/)) {
      return 'JSON'
    }

    return null
  }

  function overridesDatabaseType(property) {
    return getDatabaseType(property) !== null
  }

  return {
    overridesDatabaseType,
    getDatabaseType,
  }
}
