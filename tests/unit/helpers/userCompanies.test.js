const { ObjectID } = require('mongodb');
const Boom = require('@hapi/boom');
const expect = require('expect');
const sinon = require('sinon');
const UserCompany = require('../../../src/models/UserCompany');
const UserCompaniesHelper = require('../../../src/helpers/userCompanies');
const SinonMongoose = require('../sinonMongoose');
const CompanyLinkRequest = require('../../../src/models/CompanyLinkRequest');

describe('create', () => {
  let findOne;
  let create;
  let deleteManyCompanyLinkRequest;

  beforeEach(() => {
    create = sinon.stub(UserCompany, 'create');
    findOne = sinon.stub(UserCompany, 'findOne');
    deleteManyCompanyLinkRequest = sinon.stub(CompanyLinkRequest, 'deleteMany');
  });

  afterEach(() => {
    create.restore();
    findOne.restore();
    deleteManyCompanyLinkRequest.restore();
  });

  it('should create UserCompany', async () => {
    const userId = new ObjectID();
    const companyId = new ObjectID();

    findOne.returns(SinonMongoose.stubChainedQueries([], ['lean']));

    await UserCompaniesHelper.create(userId, companyId);

    sinon.assert.calledOnceWithExactly(create, { user: userId, company: companyId });
    sinon.assert.calledOnceWithExactly(deleteManyCompanyLinkRequest, { user: userId });
    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ user: userId }, { company: 1 }] }, { query: 'lean' }]
    );
  });

  it('should do nothing if already userCompany for this user and this company', async () => {
    const userId = new ObjectID();
    const companyId = new ObjectID();

    findOne.returns(SinonMongoose.stubChainedQueries([{ user: userId, company: companyId }], ['lean']));

    await UserCompaniesHelper.create(userId, companyId);

    sinon.assert.notCalled(create);
    sinon.assert.notCalled(deleteManyCompanyLinkRequest);
    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ user: userId }, { company: 1 }] }, { query: 'lean' }]
    );
  });

  it('should throw an error if already userCompany for this user and an other company', async () => {
    const userId = new ObjectID();
    const companyId = new ObjectID();

    try {
      findOne.returns(SinonMongoose.stubChainedQueries([{ user: userId, company: new ObjectID() }], ['lean']));

      await UserCompaniesHelper.create(userId, companyId);

      expect(true).toBe(false);
    } catch (e) {
      expect(e).toEqual(Boom.conflict());
      sinon.assert.notCalled(create);
      sinon.assert.notCalled(deleteManyCompanyLinkRequest);
      SinonMongoose.calledWithExactly(
        findOne,
        [{ query: 'findOne', args: [{ user: userId }, { company: 1 }] }, { query: 'lean' }]
      );
    }
  });
});
