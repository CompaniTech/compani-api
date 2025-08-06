const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const has = require('lodash/has');
const CourseBillingItem = require('../../../src/models/CourseBillingItem');
const CourseBillingItemHelper = require('../../../src/helpers/courseBillingItems');
const SinonMongoose = require('../sinonMongoose');

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(CourseBillingItem, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return all course billing items', async () => {
    const credentials = { role: { vendor: 'training_organisation_manager' } };
    const courseBillingItems = [
      { name: 'article' },
      { name: 'frais formateur' },
    ];
    find.returns(SinonMongoose.stubChainedQueries(courseBillingItems));

    const result = await CourseBillingItemHelper.list(credentials);

    expect(result).toBe(courseBillingItems);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find' },
        {
          query: 'populate',
          args: [{ path: 'courseBillCount', options: { isVendorUser: has(credentials, 'role.vendor') } }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('create', () => {
  let create;

  beforeEach(() => {
    create = sinon.stub(CourseBillingItem, 'create');
  });

  afterEach(() => {
    create.restore();
  });

  it('should create a course billing item', async () => {
    const newItem = { name: 'article' };
    await CourseBillingItemHelper.create(newItem);

    sinon.assert.calledOnceWithExactly(create, newItem);
  });
});

describe('remove', () => {
  let deleteOne;

  beforeEach(() => {
    deleteOne = sinon.stub(CourseBillingItem, 'deleteOne');
  });

  afterEach(() => {
    deleteOne.restore();
  });

  it('should delete a course billing item', async () => {
    const billingItemId = new ObjectId();
    await CourseBillingItemHelper.remove({ _id: billingItemId });

    sinon.assert.calledOnceWithExactly(deleteOne, { _id: billingItemId });
  });
});
