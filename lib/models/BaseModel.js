const { Model, raw } = require('objection')
const moment = require('moment')

class BaseModel extends Model {
  static get timestamps() {
    return true
  }

  $beforeInsert() {
    if (this.constructor.timestamps) {
      const timestamp = this.$knex().fn.now()
      this.created_at = raw(timestamp)
      this.updated_at = raw(timestamp)
    }
  }

  $beforeUpdate() {
    if (this.constructor.timestamps) {
      const timestamp = this.$knex().fn.now()
      this.updated_at = raw(timestamp)
    }
  }

  // I'm leaving here as a reminder to self:
  // 1) It's not needed. I found out the problem I had was Apollo server converting Date objects to integers.
  // 2) The dates being put into my MySQL database via knex using knex.fn.now() used the local timezone.
  //    Setting environment variable TZ=UTC fixes that.
  // $parseDatabaseJson(json) {
  //   if ('created_at' in json) {
  //     json.created_at = moment.utc(json.created_at).toDate()
  //   }
  //   if ('updated_at' in json) {
  //     json.updated_at = moment.utc(json.updated_at).toDate()
  //   }
  //   return super.$parseDatabaseJson(json);
  // }
}

module.exports = BaseModel
