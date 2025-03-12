const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const AuthorizationHelper = require('../../../src/helpers/authorization');
const User = require('../../../src/models/User');
const { AUXILIARY_WITHOUT_COMPANY } = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('validate', () => {
  let findById;
  beforeEach(() => {
    findById = sinon.stub(User, 'findById');
  });
  afterEach(() => {
    findById.restore();
  });

  it('should not authenticate as user does not exist', async () => {
    const result = await AuthorizationHelper.validate({});
    expect(result).toEqual({ isValid: false });
  });

  it('should authenticate user without role and company', async () => {
    const userId = new ObjectId();
    const user = { _id: userId, identity: { lastname: 'lastname' }, local: { email: 'email@email.com' } };

    findById.returns(SinonMongoose.stubChainedQueries(user, ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        scope: [`user:read-${userId}`, `user:edit-${userId}`],
        role: {},
        company: null,
        holding: null,
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        {
          query: 'populate',
          args: [{ path: 'holding', populate: { path: 'holding', select: '_id', populate: { path: 'companies' } } }],
        },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate user with company without erp subscription and with holding role', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const holding = { _id: new ObjectId(), companies: [companyId, otherCompanyId] };
    const userId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: {
        client: { name: 'client_admin', interface: 'client' },
        vendor: { name: 'vendor_admin', interface: 'vendor' },
        holding: { name: 'holding_admin', interface: 'holding' },
      },
      company: { _id: companyId, subscriptions: { erp: false } },
      holding,
      local: { email: 'email@email.com' },
    };

    findById.returns(SinonMongoose.stubChainedQueries(user, ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: companyId, subscriptions: { erp: false } },
        holding,
        scope: [
          `user:read-${userId}`,
          `user:edit-${userId}`,
          'client_admin',
          'vendor_admin',
          'holding_admin',
          'attendances:read',
          'companies:read',
          'companylinkrequests:edit',
          'vendorcompanies:read',
          'coursebills:read',
          'courses:edit',
          'courses:read',
          'email:send',
          'exports:edit',
          'roles:read',
          'trainingcontracts:read',
          'users:edit',
          'users:exist',
          'users:list',
          'attendances:edit',
          'companies:create',
          'companies:edit',
          'vendorcompanies:edit',
          'completioncertificates:read',
          'coursebills:edit',
          'courses:create',
          'exports:read',
          'holdings:edit',
          'holdings:read',
          'programs:edit',
          'programs:read',
          'questionnaires:edit',
          'questionnaires:read',
          'questionnairehistories:edit',
          'scripts:run',
          'trainermissions:edit',
          'trainermissions:read',
          `company-${companyId}`,
          `company-${otherCompanyId}`,
        ],
        role: {
          client: { name: 'client_admin' },
          vendor: { name: 'vendor_admin' },
          holding: { name: 'holding_admin' },
        },
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        {
          query: 'populate',
          args: [{ path: 'holding', populate: { path: 'holding', select: '_id', populate: { path: 'companies' } } }],
        },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate user with company with erp subscription', async () => {
    const userId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: { client: { name: 'client_admin', interface: 'client' } },
      company: { _id: 'company', subscriptions: { erp: true } },
      local: { email: 'email@email.com' },
    };

    findById.returns(SinonMongoose.stubChainedQueries(user, ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: true } },
        scope: [
          `user:read-${userId}`,
          `user:edit-${userId}`,
          'client_admin',
          'attendances:read',
          'bills:read',
          'companies:read',
          'companylinkrequests:edit',
          'vendorcompanies:read',
          'coursebills:read',
          'courses:edit',
          'courses:read',
          'email:send',
          'exports:edit',
          'exports:read',
          'roles:read',
          'taxcertificates:read',
          'trainingcontracts:read',
          'users:edit',
          'users:exist',
          'users:list',
          `company-${user.company._id}`,
        ],
        role: { client: { name: 'client_admin' } },
        holding: null,
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        {
          query: 'populate',
          args: [{ path: 'holding', populate: { path: 'holding', select: '_id', populate: { path: 'companies' } } }],
        },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate auxiliary without company', async () => {
    const userId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: { client: { name: AUXILIARY_WITHOUT_COMPANY, interface: 'client' } },
      company: { _id: 'company', subscriptions: { erp: true } },
      local: { email: 'email@email.com' },
      holding: null,
    };

    findById.returns(SinonMongoose.stubChainedQueries(user, ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: true } },
        scope: [`user:read-${userId}`, `user:edit-${userId}`, 'auxiliary_without_company'],
        role: { client: { name: AUXILIARY_WITHOUT_COMPANY } },
        holding: null,
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        {
          query: 'populate',
          args: [{ path: 'holding', populate: { path: 'holding', select: '_id', populate: { path: 'companies' } } }],
        },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate a user with coach and trainer role', async () => {
    const userId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: { client: { name: 'coach', interface: 'client' }, vendor: { name: 'trainer' } },
      company: { _id: 'company', subscriptions: { erp: true } },
      local: { email: 'email@email.com' },
    };

    findById.returns(SinonMongoose.stubChainedQueries(user, ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: true } },
        scope: [
          `user:read-${userId}`,
          `user:edit-${userId}`,
          'coach',
          'trainer',
          'attendances:read',
          'bills:read',
          'companylinkrequests:edit',
          'vendorcompanies:read',
          'courses:edit',
          'courses:read',
          'email:send',
          'exports:edit',
          'exports:read',
          'roles:read',
          'taxcertificates:read',
          'trainingcontracts:read',
          'users:edit',
          'users:exist',
          'users:list',
          'attendances:edit',
          'holdings:read',
          'questionnaires:read',
          'questionnairehistories:edit',
        ],
        role: { client: { name: 'coach' }, vendor: { name: 'trainer' } },
        holding: null,
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        {
          query: 'populate',
          args: [{ path: 'holding', populate: { path: 'holding', select: '_id', populate: { path: 'companies' } } }],
        },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });
});
