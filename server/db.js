/**
 * Database access layer facade (users, objects, entries, protocols, farm card).
 */
const core = require('./db/core');
const users = require('./db/users');
const reports = require('./db/reports');
const objects = require('./db/objects');
const entries = require('./db/entries');
const protocols = require('./db/protocols');
const stallLayout = require('./db/stall-layout');
const farmCard = require('./db/farm-card');
const userObjects = require('./db/user-objects');
const accessRequests = require('./db/access-requests');

module.exports = {
  ...core,
  ...users,
  ...reports,
  ...objects,
  ...entries,
  ...protocols,
  ...stallLayout,
  ...farmCard,
  ...userObjects,
  ...accessRequests,
};
