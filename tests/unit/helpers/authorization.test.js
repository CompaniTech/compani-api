const expect = require('expect');
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

    findById.returns(SinonMongoose.stubChainedQueries([user], ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        scope: [`user:read-${userId}`, `user:edit-${userId}`],
        role: {},
        sector: null,
        company: null,
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        { query: 'populate', args: [{ path: 'sector', options: { requestingOwnInfos: true } }] },
        { query: 'populate', args: [{ path: 'customers', options: { requestingOwnInfos: true } }] },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate user with company without erp subscription', async () => {
    const userId = new ObjectId();
    const sectorId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: {
        client: { name: 'client_admin', interface: 'client' },
        vendor: { name: 'vendor_admin', interface: 'vendor' },
      },
      company: { _id: 'company', subscriptions: { erp: false } },
      local: { email: 'email@email.com' },
      sector: sectorId,
    };

    findById.returns(SinonMongoose.stubChainedQueries([user], ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: false } },
        sector: sectorId.toHexString(),
        scope: [
          `user:read-${userId}`,
          `user:edit-${userId}`,
          'client_admin',
          'vendor_admin',
          'attendancesheets:read',
          'companylinkrequests:edit',
          'courses:edit',
          'courses:read',
          'email:send',
          'exports:edit',
          'roles:read',
          'users:edit',
          'users:exist',
          'users:list',
          'attendancesheets:edit',
          'companies:create',
          'companies:edit',
          'companies:read',
          'courses:create',
          'exports:read',
          'programs:edit',
          'programs:read',
          'questionnaires:edit',
          'questionnaires:read',
          'scripts:run',
          `company-${user.company._id}`,
        ],
        role: { client: { name: 'client_admin' }, vendor: { name: 'vendor_admin' } },
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        { query: 'populate', args: [{ path: 'sector', options: { requestingOwnInfos: true } }] },
        { query: 'populate', args: [{ path: 'customers', options: { requestingOwnInfos: true } }] },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate user with company with erp subscription', async () => {
    const userId = new ObjectId();
    const sectorId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: { client: { name: 'client_admin', interface: 'client' } },
      company: { _id: 'company', subscriptions: { erp: true } },
      local: { email: 'email@email.com' },
      sector: sectorId,
    };

    findById.returns(SinonMongoose.stubChainedQueries([user], ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: true } },
        sector: sectorId.toHexString(),
        scope: [
          `user:read-${userId}`,
          `user:edit-${userId}`,
          'client_admin',
          'attendancesheets:read',
          'bills:edit',
          'bills:read',
          'companylinkrequests:edit',
          'config:edit',
          'config:read',
          'contracts:edit',
          'courses:edit',
          'courses:read',
          'customers:administrative:edit',
          'customers:create',
          'customers:edit',
          'customers:read',
          'customerpartners:edit',
          'email:send',
          'establishments:edit',
          'establishments:read',
          'events:edit',
          'events:read',
          'exports:edit',
          'exports:read',
          'helpers:list',
          'helpers:edit',
          'pay:edit',
          'pay:read',
          'paydocuments:edit',
          'payments:edit',
          'partnerorganizations:edit',
          'partners:read',
          'partners:edit',
          'roles:read',
          'sms:send',
          'taxcertificates:edit',
          'taxcertificates:read',
          'users:edit',
          'users:exist',
          'users:list',
          `company-${user.company._id}`,
        ],
        role: { client: { name: 'client_admin' } },
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        { query: 'populate', args: [{ path: 'sector', options: { requestingOwnInfos: true } }] },
        { query: 'populate', args: [{ path: 'customers', options: { requestingOwnInfos: true } }] },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate user with customers', async () => {
    const userId = new ObjectId();
    const sectorId = new ObjectId();
    const customerId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: { client: { name: 'helper', interface: 'client' } },
      customers: [customerId],
      company: { _id: 'company', subscriptions: { erp: true } },
      local: { email: 'email@email.com' },
      sector: sectorId,
    };

    findById.returns(SinonMongoose.stubChainedQueries([user], ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: true } },
        sector: sectorId.toHexString(),
        scope: [`user:read-${userId}`, `user:edit-${userId}`, 'helper', `customer-${customerId.toHexString()}`],
        role: { client: { name: 'helper' } },
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        { query: 'populate', args: [{ path: 'sector', options: { requestingOwnInfos: true } }] },
        { query: 'populate', args: [{ path: 'customers', options: { requestingOwnInfos: true } }] },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate auxiliary without company', async () => {
    const userId = new ObjectId();
    const sectorId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: { client: { name: AUXILIARY_WITHOUT_COMPANY, interface: 'client' } },
      company: { _id: 'company', subscriptions: { erp: true } },
      local: { email: 'email@email.com' },
      sector: sectorId,
    };

    findById.returns(SinonMongoose.stubChainedQueries([user], ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: true } },
        sector: sectorId.toHexString(),
        scope: [`user:read-${userId}`, `user:edit-${userId}`, 'auxiliary_without_company'],
        role: { client: { name: AUXILIARY_WITHOUT_COMPANY } },
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        { query: 'populate', args: [{ path: 'sector', options: { requestingOwnInfos: true } }] },
        { query: 'populate', args: [{ path: 'customers', options: { requestingOwnInfos: true } }] },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });

  it('should authenticate a user with coach and trainer role', async () => {
    const userId = new ObjectId();
    const sectorId = new ObjectId();
    const user = {
      _id: userId,
      identity: { lastname: 'lastname' },
      role: { client: { name: 'coach', interface: 'client' }, vendor: { name: 'trainer' } },
      company: { _id: 'company', subscriptions: { erp: true } },
      local: { email: 'email@email.com' },
      sector: sectorId,
    };

    findById.returns(SinonMongoose.stubChainedQueries([user], ['populate', 'lean']));

    const result = await AuthorizationHelper.validate({ _id: userId });

    expect(result).toEqual({
      isValid: true,
      credentials: {
        _id: userId,
        identity: { lastname: 'lastname' },
        email: 'email@email.com',
        company: { _id: 'company', subscriptions: { erp: true } },
        sector: sectorId.toHexString(),
        scope: [
          `user:read-${userId}`,
          `user:edit-${userId}`,
          'coach',
          'trainer',
          'attendancesheets:read',
          'bills:read',
          'companylinkrequests:edit',
          'config:read',
          'contracts:edit',
          'courses:edit',
          'courses:read',
          'customers:administrative:edit',
          'customers:create',
          'customers:edit',
          'customers:read',
          'customerpartners:edit',
          'email:send',
          'establishments:read',
          'events:edit',
          'events:read',
          'exports:edit',
          'exports:read',
          'helpers:list',
          'helpers:edit',
          'pay:read',
          'paydocuments:edit',
          'partnerorganizations:edit',
          'partners:read',
          'partners:edit',
          'roles:read',
          'sms:send',
          'taxcertificates:edit',
          'taxcertificates:read',
          'users:edit',
          'users:exist',
          'users:list',
          'attendancesheets:edit',
          'questionnaires:read',
        ],
        role: { client: { name: 'coach' }, vendor: { name: 'trainer' } },
      },
    });
    SinonMongoose.calledOnceWithExactly(
      findById,
      [
        { query: 'findById', args: [userId, '_id identity role local'] },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company' } }] },
        { query: 'populate', args: [{ path: 'sector', options: { requestingOwnInfos: true } }] },
        { query: 'populate', args: [{ path: 'customers', options: { requestingOwnInfos: true } }] },
        { query: 'lean', args: [{ autopopulate: true }] },
      ]
    );
  });
});
