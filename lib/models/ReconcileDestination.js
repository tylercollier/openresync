const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const ReconcileResource = require('./ReconcileResource')

class ReconcileDestination extends BaseModel {
  static get tableName() {
    return 'ors_reconcile_destinations'
  }

  static get relationMappings() {
    return {
      resource: {
        relation: Model.BelongsToOneRelation,
        modelClass: ReconcileResource,
        join: {
          from: 'ors_reconcile_destinations.reconcile_resources_id',
          to: 'ors_reconcile_resources.id',
        },
      },
    }
  }
}

module.exports = ReconcileDestination
