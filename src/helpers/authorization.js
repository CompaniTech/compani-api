const get = require('lodash/get');
const pick = require('lodash/pick');
const User = require('../models/User');
const { rights } = require('../data/rights');
const { CLIENT_ADMIN, CLIENT } = require('./constants');

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

    const user = await User.findById(decoded._id, '_id identity role local')
      .populate({ path: 'company', populate: { path: 'company' } })
      .populate({ path: 'holding', populate: { path: 'holding', populate: { path: 'companies' } } })
      .populate({ path: 'sector', options: { requestingOwnInfos: true } })
      .populate({ path: 'customers', options: { requestingOwnInfos: true } })
      .lean({ autopopulate: true });

    const userRoles = user.role ? Object.values(user.role).filter(role => !!role) : [];

    const userRolesName = userRoles.map(role => role.name);
    const userRights = formatRights(userRoles, user.company);

    const customersScopes = user.customers ? user.customers.map(id => `customer-${id.toHexString()}`) : [];
    const scope = [
      `user:read-${decoded._id}`,
      `user:edit-${decoded._id}`,
      ...userRolesName,
      ...userRights,
      ...customersScopes,
    ];

    if (get(user, 'role.client.name') === CLIENT_ADMIN) scope.push(`company-${user.company._id}`);
    const credentials = {
      email: get(user, 'local.email', null),
      _id: decoded._id,
      identity: user.identity || null,
      company: user.company || null,
      holding: user.holding ? { _id: user.holding._id, companies: user.holding.companies } : null,
      sector: user.sector ? user.sector.toHexString() : null,
      role: pick(user.role, ['client.name', 'vendor.name', 'holding.name']),
      scope,
    };

    return { isValid: true, credentials };
  } catch (e) {
    console.error(e);
    return { isValid: false };
  }
};

module.exports = { validate };
