const Boom = require('@hapi/boom');
const get = require('lodash/get');
const { ObjectId } = require('mongodb');
const UtilsHelper = require('../../helpers/utils');

const getDocListMiddlewareList = ['find'];

const getDocMiddlewareList = [
  'findOne',
  'findOneAndDelete',
  'findOneAndDelete',
  'findOneAndUpdate',
];

const queryMiddlewareList = [
  ...getDocListMiddlewareList,
  ...getDocMiddlewareList,
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'remove',
  'updateOne',
  'updateMany',
];

module.exports = {
  getDocListMiddlewareList,
  getDocMiddlewareList,
  queryMiddlewareList,
  validateQuery() {
    const query = this.getQuery();
    const isPopulate = get(query, '_id.$in', null);
    const hasCompany = (query.$and && query.$and.some(q => !!q.company || !!query.companies)) ||
      (query.$or && query.$or.every(q => !!q.company || !!query.companies)) || query.company || query.companies;
    const { isVendorUser, requestingOwnInfos, allCompanies } = this.getOptions();

    if (!hasCompany && !isPopulate && !isVendorUser && !requestingOwnInfos && !allCompanies) throw Boom.badRequest();
  },
  formatQuery() {
    const query = this.getQuery();
    const flattenQuery = {};
    for (const [key, value] of Object.entries(query)) {
      const isValueAnObject = value && typeof value === 'object' && !Array.isArray(value);
      const doesValueNotStartWithDollarSign = value && Object.keys(value)[0] && Object.keys(value)[0].charAt(0) !== '$';
      if (isValueAnObject && doesValueNotStartWithDollarSign) {
        const flattenEntry = UtilsHelper.flatQuery({ [key]: value });
        Object.assign(flattenQuery, flattenEntry);
      } else {
        const untouchedEntry = { [key]: value };
        Object.assign(flattenQuery, untouchedEntry);
      }
    }

    this.setQuery(flattenQuery);
  },
  formatQueryMiddlewareList() {
    return [
      'countDocuments',
      'find',
      'findOne',
      'deleteMany',
      'deleteOne',
      'findOneAndDelete',
      'findOneAndDelete',
      'remove',
      'findOneAndUpdate',
      'updateOne',
      'updateMany',
    ];
  },
  validateAggregation() {
    if (get(this, 'options.allCompanies', null)) return;

    const companyId = get(this, 'options.company', null);
    if (!companyId) throw Boom.badRequest();

    this.pipeline().unshift({ $match: { company: new ObjectId(companyId) } });
  },
  validateUpdateOne() {
    const query = this.getQuery();
    if (!query.company) throw Boom.badRequest();
  },
};
