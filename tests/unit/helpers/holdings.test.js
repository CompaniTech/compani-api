const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const CompanyHolding = require('../../../src/models/CompanyHolding');
const Holding = require('../../../src/models/Holding');
const HoldingHelper = require('../../../src/helpers/holdings');
const SinonMongoose = require('../sinonMongoose');

describe('create', () => {
  let create;
  beforeEach(() => {
    create = sinon.stub(Holding, 'create');
  });
  afterEach(() => {
    create.restore();
  });

  it('should create a holding', async () => {
    const payload = { name: 'Test SAS', address: '24 avenue Daumesnil 75012 Paris' };

    await HoldingHelper.create(payload);

    sinon.assert.calledOnceWithExactly(create, payload);
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(Holding, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return holdings', async () => {
    const holdingList = [{ _id: new ObjectId(), name: 'Holding', companies: [new ObjectId(), new ObjectId()] }];
    find.returns(SinonMongoose.stubChainedQueries(holdingList));

    const result = await HoldingHelper.list();

    expect(result).toEqual(holdingList);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{}, { _id: 1, name: 1 }] },
        { query: 'populate', args: [{ path: 'companies' }] },
        { query: 'lean', args: [] },
      ]
    );
  });
});

describe('update', () => {
  let insertMany;
  beforeEach(() => {
    insertMany = sinon.stub(CompanyHolding, 'insertMany');
  });
  afterEach(() => {
    insertMany.restore();
  });

  it('should link a company to a holding', async () => {
    const holdingId = new ObjectId();
    const payload = { companies: [new ObjectId(), new ObjectId()] };

    await HoldingHelper.update(holdingId, payload);

    sinon.assert.calledOnceWithExactly(insertMany,
      [
        { holding: holdingId, company: payload.companies[0] },
        { holding: holdingId, company: payload.companies[1] },
      ]);
  });
});

describe('getById', () => {
  let findOne;
  beforeEach(() => {
    findOne = sinon.stub(Holding, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should return holding', async () => {
    const holdingId = new ObjectId();
    const holding = { _id: holdingId, name: 'Holding' };
    findOne.returns(SinonMongoose.stubChainedQueries(holding));

    const result = await HoldingHelper.getById(holdingId);

    expect(result).toEqual(holding);
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: holdingId }, { _id: 1, name: 1 }] },
        { query: 'populate', args: [{ path: 'companies', populate: { path: 'company', select: 'name' } }] },
        {
          query: 'populate',
          args: [{ path: 'users', populate: { path: 'user', select: 'identity local.email contact' } }],
        },
        { query: 'lean', args: [] }]
    );
  });
});
