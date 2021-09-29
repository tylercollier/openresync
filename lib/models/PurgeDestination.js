const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const PurgeResource = require('./PurgeResource')

class PurgeDestination extends BaseModel {
  static get tableName() {
    return 'ors_purge_destinations'
  }

  static get relationMappings() {
    return {
      resource: {
        relation: Model.BelongsToOneRelation,
        modelClass: PurgeResource,
        join: {
          from: 'ors_purge_destinations.purge_resources_id',
          to: 'ors_purge_resources.id',
        },
      },
    }
  }

  // For old versions of mysql that don't natively support JSON, ObjectionJS uses type longtext. The problem is when it
  // fetches the data, it doesn't know to parse it as JSON. So we do it ourselves. (This is a little bit of an
  // assumption. I didn't used to need to do this when I was using MySQL 8, and then I switched to MariaDB 5.6 and
  // encountered this problem.)
  // Reminder from the docs that this function must be pure.
  $parseDatabaseJson(json) {
    let val = super.$parseDatabaseJson(json)
    if (val && val.ids_purged) {
      const parsed = JSON.parse(json.ids_purged)
      val.ids_purged = parsed
    }
    return val
  }
}

module.exports = PurgeDestination
