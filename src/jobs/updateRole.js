const moment = require('moment');
const User = require('../models/User');
const Role = require('../models/Role');
const { AUXILIARY_WITHOUT_COMPANY } = require('../helpers/constants');
const EmailHelper = require('../helpers/email');

const updateRole = {
  async method() {
    let error;
    let updatedUsersCount = 0;
    try {
      const role = await Role.findOne({ name: AUXILIARY_WITHOUT_COMPANY }).lean();

      const updatedUsers = await User.updateMany(
        { inactivityDate: moment().startOf('M').toDate() },
        { $set: { 'role.client': role._id } }
      );
      updatedUsersCount = updatedUsers.nModified;
    } catch (e) {
      error = e.message;
    }
    return { results: updatedUsersCount, error };
  },

  async onComplete(server, { results, error }) {
    try {
      server.log(['cron'], 'update role OK');
      if (error) server.log(['error', 'cron', 'oncomplete'], error);
      server.log(['cron', 'oncomplete'], `${results} role updated.`);
      EmailHelper.completeRoleUpdateScriptEmail(results);
    } catch (e) {
      server.log(['error', 'cron', 'oncomplete'], e);
    }
  },
};

module.exports = updateRole;
