const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');
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
    const courseBillingItems = [
      { name: 'article' },
      { name: 'frais formateur' },
    ];
    find.returns(SinonMongoose.stubChainedQueries(courseBillingItems, ['lean']));

    const result = await CourseBillingItemHelper.list();

    expect(result).toBe(courseBillingItems);
    SinonMongoose.calledOnceWithExactly(find, [{ query: 'find' }, { query: 'lean' }]);
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
