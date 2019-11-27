const expect = require('expect');
const { ObjectID } = require('mongodb');
const Boom = require('boom');
const sinon = require('sinon');
const UtilsHelper = require('../../../src/helpers/utils');
const FundingsHelper = require('../../../src/helpers/fundings');
const CustomerRepository = require('../../../src/repositories/CustomerRepository');
const Customer = require('../../../src/models/Customer');

require('sinon-mongoose');

describe('exportFundings', () => {
  let getCustomerFundings;
  let getLastVersion;
  let formatFloatForExport;
  let mergeLastVersionWithBaseObject;
  const credentials = { company: { _id: new ObjectID() } };

  beforeEach(() => {
    getCustomerFundings = sinon.stub(CustomerRepository, 'getCustomerFundings');
    getLastVersion = sinon.stub(UtilsHelper, 'getLastVersion').callsFake(v => v[0]);
    formatFloatForExport = sinon.stub(UtilsHelper, 'formatFloatForExport');
    mergeLastVersionWithBaseObject = sinon.stub(UtilsHelper, 'mergeLastVersionWithBaseObject');
    formatFloatForExport.callsFake(float => (float != null ? `F-${float}` : ''));
    mergeLastVersionWithBaseObject.returnsArg(0);
  });

  afterEach(() => {
    getCustomerFundings.restore();
    formatFloatForExport.restore();
    getLastVersion.restore();
    mergeLastVersionWithBaseObject.restore();
  });

  it('should return csv header', async () => {
    const customers = [];
    getCustomerFundings.returns(customers);

    const result = await FundingsHelper.exportFundings(credentials);

    sinon.assert.notCalled(getLastVersion);
    sinon.assert.notCalled(formatFloatForExport);
    expect(result).toBeDefined();
    expect(result[0]).toMatchObject(['Titre', 'Nom', 'Prénom', 'Tiers payeur', 'Nature', 'Service', 'Date de début', 'Date de fin',
      'Numéro de dossier', 'Fréquence', 'Montant TTC', 'Montant unitaire TTC', 'Nombre d\'heures', 'Jours', 'Participation du bénéficiaire']);
  });

  it('should return customer info', async () => {
    const customers = [
      { identity: { lastname: 'Autonomie', title: 'mr' } },
    ];

    getCustomerFundings.returns(customers);

    const result = await FundingsHelper.exportFundings(credentials);

    expect(result).toBeDefined();
    expect(result[1]).toBeDefined();
    expect(result[1]).toMatchObject(['M.', 'AUTONOMIE', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  });

  it('should return funding third party payer', async () => {
    const customers = [
      { funding: { thirdPartyPayer: { name: 'tpp' } } },
    ];

    getCustomerFundings.returns(customers);

    const result = await FundingsHelper.exportFundings(credentials);

    expect(result).toBeDefined();
    expect(result[1]).toBeDefined();
    expect(result[1]).toMatchObject(['', '', '', 'tpp', '', '', '', '', '', '', '', '', '', '', '']);
  });

  it('should return funding service', async () => {
    const customers = [
      { funding: { subscription: { service: { versions: [{ name: 'Toto' }] } } } },
    ];

    getCustomerFundings.returns(customers);

    const result = await FundingsHelper.exportFundings(credentials);

    sinon.assert.calledOnce(mergeLastVersionWithBaseObject);
    sinon.assert.calledOnce(getLastVersion);
    sinon.assert.callCount(formatFloatForExport, 4);
    expect(result).toBeDefined();
    expect(result[1]).toBeDefined();
    expect(result[1]).toMatchObject(['', '', '', '', '', 'Toto', '', '', '', '', '', '', '', '', '']);
  });

  it('should return funding info', async () => {
    const customers = [
      {
        funding: {
          nature: 'fixed',
          frequency: 'once',
          startDate: '2018-07-15T00:00:00.000+00:00',
          endDate: '2018-07-15T00:00:00.000+00:00',
          folderNumber: 'Toto',
          amountTTC: 12,
          unitTTCRate: 14,
          careHours: 3,
          careDays: [1, 4, 5],
          customerParticipationRate: 90,
        },
      },
    ];

    getCustomerFundings.returns(customers);

    const result = await FundingsHelper.exportFundings(credentials);

    sinon.assert.calledOnce(mergeLastVersionWithBaseObject);
    sinon.assert.notCalled(getLastVersion);
    sinon.assert.callCount(formatFloatForExport, 4);
    expect(result).toBeDefined();
    expect(result[1]).toBeDefined();
    expect(result[1]).toMatchObject(['', '', '', '', 'Forfaitaire', '', '15/07/2018', '15/07/2018', 'Toto', 'Une seule fois', 'F-12', 'F-14', 'F-3',
      'Mardi Vendredi Samedi ', 'F-90']);
  });
});

describe('checkSubscriptionFunding', () => {
  const checkedFundingSubscriptionId = new ObjectID();
  const fundingId = new ObjectID();
  const checkedFunding = {
    _id: fundingId.toHexString(),
    subscription: checkedFundingSubscriptionId.toHexString(),
    versions: [{
      careDays: [0, 1, 2],
      startDate: '2019-10-01',
      endDate: '2019-11-02',
    }],
  };

  let CustomerModel;
  beforeEach(() => {
    CustomerModel = sinon.mock(Customer);
  });
  afterEach(() => {
    CustomerModel.restore();
  });

  it('should return an error if customer does not exists', async () => {
    try {
      const customerId = new ObjectID();
      CustomerModel.expects('findOne')
        .withExactArgs({ _id: customerId })
        .chain('lean')
        .once()
        .returns(null);

      await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);
    } catch (e) {
      expect(e).toEqual(Boom.notFound('Error while checking subscription funding: customer not found.'));
    }
  });

  it('should return true if customer does not have fundings', async () => {
    const customerId = new ObjectID();
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({});

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(true);
    CustomerModel.verify();
  });

  it('should return true if customer does not have fundings', async () => {
    const customerId = new ObjectID();
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({ fundings: [] });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(true);
    CustomerModel.verify();
  });

  it('should return true if the only fundings customer has is the one being updated', async () => {
    const customerId = new ObjectID();
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({
        fundings: [{
          _id: fundingId,
          subscription: checkedFundingSubscriptionId,
          versions: [{
            careDays: [0, 1, 2],
            startDate: '2019-10-01',
            endDate: '2019-11-02',
          }],
        }],
      });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(true);
    CustomerModel.verify();
  });

  it('should return true if checkedFunding does not have careDays in common with the other funding', async () => {
    const customerId = new ObjectID();
    const fundings = [
      {
        _id: new ObjectID(),
        subscription: checkedFundingSubscriptionId,
        versions: [{
          careDays: [4, 5],
          startDate: '2018-10-01',
          endDate: '2019-12-01',
        }],
      },
    ];
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({ fundings });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(true);
    CustomerModel.verify();
  });

  it('should return true if checkedFunding startDate is after the other funding endDate', async () => {
    const customerId = new ObjectID();
    const fundings = [
      {
        _id: new ObjectID(),
        subscription: checkedFundingSubscriptionId,
        versions: [{
          careDays: [0, 1, 2, 3],
          startDate: '2018-10-01',
          endDate: '2018-12-01',
        }],
      },
    ];
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({ fundings });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(true);
    CustomerModel.verify();
  });

  it('should return true if checkedFunding endDate is before the other funding startDate', async () => {
    const customerId = new ObjectID();
    const fundings = [
      {
        _id: new ObjectID(),
        subscription: checkedFundingSubscriptionId,
        versions: [{
          careDays: [0, 1, 2, 3],
          startDate: '2019-11-03',
          endDate: '2019-12-01',
        }],
      },
    ];
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({ fundings });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(true);
    CustomerModel.verify();
  });

  it('should return true if checkedFunding and other fundings are not for the same subscription', async () => {
    const customerId = new ObjectID();
    const fundings = [
      {
        _id: new ObjectID(),
        subscription: new ObjectID(),
        versions: [{
          careDays: [0, 1, 2, 3],
          startDate: '2018-11-03',
          endDate: '2019-10-22',
        }],
      },
    ];
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({ fundings });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(true);
    CustomerModel.verify();
  });

  it('should return false if checkedFunding has a careDays in common with other fundings are on the same period', async () => {
    const customerId = new ObjectID();
    const fundings = [
      {
        _id: new ObjectID(),
        subscription: checkedFundingSubscriptionId,
        versions: [{
          careDays: [0, 1, 2, 3],
          startDate: '2018-11-03',
          endDate: '2019-10-22',
        }],
      },
    ];
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({ fundings });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(false);
    CustomerModel.verify();
  });

  it('should return false if one of the fundings have a conflict with checked fundings', async () => {
    const customerId = new ObjectID();
    const fundings = [
      {
        _id: new ObjectID(),
        subscription: checkedFundingSubscriptionId,
        versions: [{
          careDays: [0, 1, 2, 3],
          startDate: '2018-11-03',
          endDate: '2019-10-22',
        }],
      },
      {
        _id: new ObjectID(),
        subscription: checkedFundingSubscriptionId,
        versions: [{
          careDays: [0, 1, 2, 3],
          startDate: '2018-10-01',
          endDate: '2018-12-01',
        }],
      },
    ];
    CustomerModel.expects('findOne')
      .withExactArgs({ _id: customerId })
      .chain('lean')
      .once()
      .returns({ fundings });

    const res = await FundingsHelper.checkSubscriptionFunding(customerId, checkedFunding);

    expect(res).toBe(false);
    CustomerModel.verify();
  });
});
