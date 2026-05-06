const get = require('lodash/get');
const pick = require('lodash/pick');
const User = require('../models/User');
const { rights } = require('../data/rights');
const { CLIENT_ADMIN, CLIENT, HOLDING_ADMIN } = require('./constants');

const formatRights = (roles, company) => {
  let formattedRights = [];
  for (const role of roles) {
    let interfaceRights = rights;

    if (role.interface === CLIENT) {
      const companySubscriptions = Object.keys(company.subscriptions).filter(key => company.subscriptions[key]);
      interfaceRights = interfaceRights.filter(r => !r.subscription || companySubscriptions.includes(r.subscription));
    }

    formattedRights = formattedRights.concat(interfaceRights
      .filter(right => right.rolesConcerned.includes(role.name))
      .map(right => right.permission));
  }

  return [...new Set(formattedRights)];
};

const validate = async (decoded) => {
  try {
    if (!decoded._id) throw new Error('No id present in token');

    const user = await User.findById(decoded._id, '_id identity role local isProgramEditor')
      .populate({ path: 'company', populate: { path: 'company' } })
      .populate({ path: 'holding', populate: { path: 'holding', select: '_id', populate: { path: 'companies' } } })
      .lean({ autopopulate: true });

    const userRoles = user.role ? Object.values(user.role).filter(role => !!role) : [];

    const userRolesName = userRoles.map(role => role.name);
    const userRights = formatRights(userRoles, user.company);

    const scope = [
      `user:read-${decoded._id}`,
      `user:edit-${decoded._id}`,
      ...userRolesName,
      ...userRights,
    ];

    if (get(user, 'role.client.name') === CLIENT_ADMIN) scope.push(`company-${user.company._id}`);
    if (get(user, 'role.holding.name') === HOLDING_ADMIN) {
      user.holding.companies
        .forEach((company) => {
          if (!scope.includes(`company-${company}`)) scope.push(`company-${company}`);
        });
    }
    const credentials = {
      email: get(user, 'local.email', null),
      _id: decoded._id,
      identity: user.identity || null,
      company: user.company || null,
      holding: user.holding || null,
      role: pick(user.role, ['client.name', 'vendor.name', 'holding.name']),
      isProgramEditor: !!user.isProgramEditor,
      scope,
    };

    return { isValid: true, credentials };
  } catch (e) {
    console.error(e);
    return { isValid: false };
  }
};

module.exports = { validate };
