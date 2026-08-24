/**
 * Database access layer facade (users, objects, entries, protocols, farm card).
 */
const core = require('./db/core');
const users = require('./db/users');
const reports = require('./db/reports');
const agentStatus = require('./db/agent-status');
const objects = require('./db/objects');
const entries = require('./db/entries');
const protocols = require('./db/protocols');
const stallLayout = require('./db/stall-layout');
const farmCard = require('./db/farm-card');
const userObjects = require('./db/user-objects');
const accessRequests = require('./db/access-requests');
const bitrix = require('./db/bitrix');
const roleCapabilities = require('./db/role-capabilities');

module.exports = {
  ...core,
  ...users,
  ...reports,
  ...agentStatus,
  ...objects,
  ...entries,
  ...protocols,
  ...stallLayout,
  ...farmCard,
  ...userObjects,
  ...accessRequests,
  ...bitrix,
  ...roleCapabilities,
};
