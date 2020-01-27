const sinon = require('sinon');
const expect = require('expect');
const moment = require('../../../src/extensions/moment');
const Boom = require('boom');
const flat = require('flat');
const { ObjectID } = require('mongodb');
const EventHelper = require('../../../src/helpers/events');
const SectorHistoryHelper = require('../../../src/helpers/sectorHistories');
const ContractHelper = require('../../../src/helpers/contracts');
const UtilsHelper = require('../../../src/helpers/utils');
const ESignHelper = require('../../../src/helpers/eSign');
const CustomerHelper = require('../../../src/helpers/customers');
const UserHelper = require('../../../src/helpers/users');
const GDriveStorageHelper = require('../../../src/helpers/gdriveStorage');
const { RESIGNATION } = require('../../../src/helpers/constants');
const Contract = require('../../../src/models/Contract');
const User = require('../../../src/models/User');
const Customer = require('../../../src/models/Customer');
const EventRepository = require('../../../src/repositories/EventRepository');

require('sinon-mongoose');

describe('getContractList', () => {
  const contracts = [{ _id: new ObjectID() }];
  let ContractMock;
  beforeEach(() => {
    ContractMock = sinon.mock(Contract);
  });
  afterEach(() => {
    ContractMock.restore();
  });

  it('should return contract list', async () => {
    const credentials = { company: { _id: '1234567890' } };
    const query = { user: '1234567890' };
    ContractMock.expects('find')
      .withExactArgs({ $and: [{ company: '1234567890' }, { user: '1234567890' }] })
      .chain('populate')
      .withExactArgs({
        path: 'user',
        select: 'identity administrative.driveFolder sector contact local',
        populate: { path: 'sector', select: '_id sector', match: { company: credentials.company._id } },
      })
      .chain('populate')
      .withExactArgs({ path: 'customer', select: 'identity driveFolder' })
      .chain('lean')
      .returns(contracts);

    const result = await ContractHelper.getContractList(query, credentials);
    expect(result).toEqual(contracts);
    ContractMock.verify();
  });

  it('should format query with dates', async () => {
    const credentials = { company: { _id: '1234567890' } };
    const query = { startDate: '2019-09-09T00:00:00', endDate: '2019-09-09T00:00:00' };
    ContractMock.expects('find')
      .withExactArgs({
        $and: [
          { company: '1234567890' },
          {
            $or: [
              { versions: { $elemMatch: { startDate: { $gte: '2019-09-09T00:00:00', $lte: '2019-09-09T00:00:00' } } } },
              { endDate: { $gte: '2019-09-09T00:00:00', $lte: '2019-09-09T00:00:00' } },
            ],
          },
        ],
      })
      .chain('populate')
      .withExactArgs({
        path: 'user',
        select: 'identity administrative.driveFolder sector contact local',
        populate: { path: 'sector', select: '_id sector', match: { company: credentials.company._id } },
      })
      .chain('populate')
      .withExactArgs({ path: 'customer', select: 'identity driveFolder' })
      .chain('lean')
      .returns(contracts);

    const result = await ContractHelper.getContractList(query, credentials);
    expect(result).toEqual(contracts);
    ContractMock.verify();
  });
});

describe('createContract', () => {
  let hasNotEndedCompanyContracts;
  let ContractMock;
  let generateSignatureRequestStub;
  let UserMock;
  let CustomerMock;
  let createHistoryOnContractCreation;

  beforeEach(() => {
    hasNotEndedCompanyContracts = sinon.stub(ContractHelper, 'hasNotEndedCompanyContracts');
    generateSignatureRequestStub = sinon.stub(ESignHelper, 'generateSignatureRequest');
    createHistoryOnContractCreation = sinon.stub(SectorHistoryHelper, 'createHistoryOnContractCreation');
    ContractMock = sinon.mock(Contract);
    UserMock = sinon.mock(User);
    CustomerMock = sinon.mock(Customer);
  });

  afterEach(() => {
    hasNotEndedCompanyContracts.restore();
    generateSignatureRequestStub.restore();
    createHistoryOnContractCreation.restore();
    ContractMock.restore();
    UserMock.restore();
    CustomerMock.restore();
  });

  it('should create a new company contract', async () => {
    const payload = {
      _id: new ObjectID(),
      endDate: null,
      user: new ObjectID(),
      startDate: moment('2018-12-03T23:00:00').toDate(),
      status: 'contract_with_company',
      versions: [{ weeklyHours: 18, grossHourlyRate: 25 }],
    };
    const credentials = { company: { _id: '1234567890' } };
    const contract = { ...payload, company: '1234567890' };

    hasNotEndedCompanyContracts.returns(false);
    ContractMock.expects('create')
      .withExactArgs(contract)
      .returns(contract);
    UserMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: payload.user }, { $push: { contracts: payload._id }, $unset: { inactivityDate: '' } })
      .chain('populate')
      .withExactArgs({ path: 'sector', match: { company: credentials.company._id } })
      .chain('lean')
      .withExactArgs({ autopopulate: true, virtuals: true })
      .returns({ name: 'toto' })
      .once();
    CustomerMock.expects('updateOne').never();

    const result = await ContractHelper.createContract(payload, credentials);

    sinon.assert.notCalled(generateSignatureRequestStub);
    sinon.assert.calledWithExactly(hasNotEndedCompanyContracts, contract, '1234567890');
    sinon.assert.notCalled(createHistoryOnContractCreation);
    ContractMock.verify();
    UserMock.verify();
    CustomerMock.verify();
    expect(result).toEqual(expect.objectContaining(contract));
  });

  it('should create a new company contract and generate a signature request', async () => {
    const payload = {
      _id: new ObjectID(),
      endDate: null,
      user: new ObjectID(),
      startDate: moment('2018-12-03T23:00:00').toDate(),
      status: 'contract_with_company',
      versions: [
        {
          weeklyHours: 18,
          grossHourlyRate: 25,
          signature: { templateId: '0987654321', title: 'Test' },
        },
      ],
    };
    const credentials = { company: { _id: '1234567890' } };
    const contract = { ...payload, company: '1234567890' };

    const contractWithDoc = {
      ...contract,
      versions: [{ ...contract.versions[0], signature: { eversignId: '1234567890' } }],
    };

    hasNotEndedCompanyContracts.returns(false);
    generateSignatureRequestStub.returns({ data: { document_hash: '1234567890' } });
    ContractMock.expects('create')
      .withExactArgs(contractWithDoc)
      .returns(contractWithDoc);
    UserMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: contract.user }, { $push: { contracts: contract._id }, $unset: { inactivityDate: '' } })
      .chain('populate')
      .withExactArgs({ path: 'sector', match: { company: credentials.company._id } })
      .chain('lean')
      .withExactArgs({ autopopulate: true, virtuals: true })
      .returns({ name: 'toto' })
      .once();
    CustomerMock.expects('updateOne').never();

    const result = await ContractHelper.createContract(payload, credentials);

    sinon.assert.calledWithExactly(generateSignatureRequestStub, contract.versions[0].signature);
    sinon.assert.notCalled(createHistoryOnContractCreation);
    ContractMock.verify();
    UserMock.verify();
    CustomerMock.verify();
    expect(result).toEqual(expect.objectContaining(contractWithDoc));
  });

  it('should create a new customer contract', async () => {
    const payload = {
      _id: new ObjectID(),
      endDate: null,
      user: new ObjectID(),
      startDate: moment('2018-12-03T23:00:00').toDate(),
      status: 'contract_with_company',
      versions: [{ weeklyHours: 18, grossHourlyRate: 25 }],
      customer: new ObjectID(),
    };
    const credentials = { company: { _id: '1234567890' } };
    const contract = { ...payload, company: '1234567890' };

    hasNotEndedCompanyContracts.returns(false);

    ContractMock.expects('create')
      .withExactArgs(contract)
      .returns(contract);
    UserMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: contract.user }, { $push: { contracts: contract._id }, $unset: { inactivityDate: '' } })
      .chain('populate')
      .withExactArgs({ path: 'sector', match: { company: credentials.company._id } })
      .chain('lean')
      .withExactArgs({ autopopulate: true, virtuals: true })
      .returns({ name: 'toto' })
      .once();
    CustomerMock.expects('updateOne')
      .withExactArgs({ _id: contract.customer }, { $push: { contracts: contract._id } })
      .once();

    const result = await ContractHelper.createContract(payload, credentials);

    sinon.assert.notCalled(generateSignatureRequestStub);
    sinon.assert.calledWithExactly(hasNotEndedCompanyContracts, contract, '1234567890');
    sinon.assert.notCalled(createHistoryOnContractCreation);
    expect(result).toEqual(expect.objectContaining(contract));
    ContractMock.verify();
    UserMock.verify();
    CustomerMock.verify();
  });

  it('should create a new company contract and create sector history', async () => {
    const payload = {
      _id: new ObjectID(),
      endDate: null,
      user: new ObjectID(),
      startDate: moment('2018-12-03T23:00:00').toDate(),
      status: 'contract_with_company',
      versions: [{ weeklyHours: 18, grossHourlyRate: 25 }],
    };
    const credentials = { company: { _id: '1234567890' } };
    const contract = { ...payload, company: '1234567890' };

    hasNotEndedCompanyContracts.returns(false);
    ContractMock.expects('create')
      .withExactArgs(contract)
      .returns(contract);
    const user = { name: 'toto', sector: new ObjectID(), _id: new ObjectID() };
    UserMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: payload.user }, { $push: { contracts: payload._id }, $unset: { inactivityDate: '' } })
      .chain('populate')
      .withExactArgs({ path: 'sector', match: { company: credentials.company._id } })
      .chain('lean')
      .withExactArgs({ autopopulate: true, virtuals: true })
      .returns(user)
      .once();
    CustomerMock.expects('updateOne').never();

    const result = await ContractHelper.createContract(payload, credentials);

    sinon.assert.notCalled(generateSignatureRequestStub);
    sinon.assert.calledWithExactly(hasNotEndedCompanyContracts, contract, '1234567890');
    sinon.assert.calledWithExactly(createHistoryOnContractCreation, user, contract, credentials.company._id);
    ContractMock.verify();
    UserMock.verify();
    CustomerMock.verify();
    expect(result).toEqual(expect.objectContaining(contract));
  });

  it('should throw a 400 error if new company contract startDate is before last ended company contract', async () => {
    const contract = {
      _id: new ObjectID(),
      endDate: null,
      user: new ObjectID(),
      startDate: moment('2018-12-03T23:00:00').toDate(),
      status: 'contract_with_company',
      versions: [{ weeklyHours: 18, grossHourlyRate: 25 }],
    };
    const credentials = { company: { _id: '1234567890' } };

    try {
      hasNotEndedCompanyContracts.returns(true);
      await ContractHelper.createContract(contract, credentials);
      sinon.assert.notCalled(generateSignatureRequestStub);
      sinon.assert.notCalled(hasNotEndedCompanyContracts);
      sinon.assert.notCalled(createHistoryOnContractCreation);
    } catch (e) {
      expect(e).toEqual(Boom.badRequest('New contract start date is before last company contract end date.'));
    }
  });
});

describe('endContract', () => {
  let ContractMock;
  let updateUserInactivityDate;
  let unassignInterventionsOnContractEnd;
  let removeEventsExceptInterventionsOnContractEnd;
  let updateAbsencesOnContractEnd;
  let unassignReferentOnContractEnd;
  let updateEndDateStub;
  beforeEach(() => {
    ContractMock = sinon.mock(Contract);
    updateUserInactivityDate = sinon.stub(UserHelper, 'updateUserInactivityDate');
    unassignInterventionsOnContractEnd = sinon.stub(EventHelper, 'unassignInterventionsOnContractEnd');
    removeEventsExceptInterventionsOnContractEnd = sinon.stub(
      EventHelper,
      'removeEventsExceptInterventionsOnContractEnd'
    );
    updateAbsencesOnContractEnd = sinon.stub(EventHelper, 'updateAbsencesOnContractEnd');
    unassignReferentOnContractEnd = sinon.stub(CustomerHelper, 'unassignReferentOnContractEnd');
    updateEndDateStub = sinon.stub(SectorHistoryHelper, 'updateEndDate');
  });
  afterEach(() => {
    ContractMock.restore();
    updateUserInactivityDate.restore();
    unassignInterventionsOnContractEnd.restore();
    removeEventsExceptInterventionsOnContractEnd.restore();
    updateAbsencesOnContractEnd.restore();
    unassignReferentOnContractEnd.restore();
    updateEndDateStub.restore();
  });

  it('should end contract', async () => {
    const payload = {
      endDate: '2018-12-06T23:00:00',
      endNotificationDate: '2018-12-02T23:00:00',
      endReason: RESIGNATION,
      otherMisc: 'test',
    };
    const contract = {
      _id: new ObjectID(),
      endDate: null,
      user: new ObjectID(),
      startDate: '2018-12-03T23:00:00',
      status: 'contract_with_company',
      versions: [{ _id: new ObjectID(), startDate: '2018-12-03T23:00:00' }],
    };
    const updatedContract = {
      ...contract,
      ...payload,
      user: { _id: new ObjectID(), sector: new ObjectID() },
      versions: [{ ...contract.versions[0], endDate: payload.endDate }],
    };
    const credentials = { _id: new ObjectID(), company: { _id: '1234567890' } };

    ContractMock.expects('findOne')
      .withExactArgs({ _id: contract._id.toHexString() })
      .chain('lean')
      .once()
      .returns(contract);
    ContractMock.expects('findOneAndUpdate')
      .withExactArgs(
        { _id: contract._id.toHexString() },
        { $set: flat({ ...payload, [`versions.${contract.versions.length - 1}.endDate`]: payload.endDate }) },
        { new: true }
      )
      .chain('lean')
      .once()
      .returns(updatedContract);

    const result = await ContractHelper.endContract(contract._id.toHexString(), payload, credentials);

    sinon.assert.calledWithExactly(updateUserInactivityDate, updatedContract.user._id, payload.endDate, credentials);
    sinon.assert.calledWithExactly(unassignInterventionsOnContractEnd, updatedContract, credentials);
    sinon.assert.calledWithExactly(unassignReferentOnContractEnd, updatedContract);
    sinon.assert.calledWithExactly(removeEventsExceptInterventionsOnContractEnd, updatedContract, credentials);
    sinon.assert.calledWithExactly(
      updateAbsencesOnContractEnd,
      updatedContract.user._id,
      updatedContract.endDate,
      credentials
    );
    sinon.assert.calledWithExactly(updateEndDateStub, updatedContract.user._id, updatedContract.endDate);
    expect(result).toMatchObject(updatedContract);
    ContractMock.verify();
  });

  it('should throw an error if contract end date is before last version start date', async () => {
    try {
      const contractId = new ObjectID();
      const payload = {
        endDate: '2018-12-03T23:00:00',
        endNotificationDate: '2018-12-02T23:00:00',
        endReason: RESIGNATION,
        otherMisc: 'test',
      };
      const contract = {
        _id: new ObjectID(),
        endDate: null,
        user: new ObjectID(),
        startDate: '2018-12-05T23:00:00',
        status: 'contract_with_company',
        versions: [{ _id: new ObjectID(), startDate: '2018-12-05T23:00:00' }],
      };
      const credentials = { _id: new ObjectID(), company: { _id: '1234567890' } };

      ContractMock.expects('findOne')
        .chain('lean')
        .returns(contract)
        .once();
      ContractMock.expects('findOneAndUpdate').never();

      await ContractHelper.endContract(contractId.toHexString(), payload, credentials);
    } catch (e) {
      expect(e.output.statusCode).toEqual(409);
    } finally {
      sinon.assert.notCalled(updateUserInactivityDate);
      sinon.assert.notCalled(unassignInterventionsOnContractEnd);
      sinon.assert.notCalled(unassignReferentOnContractEnd);
      sinon.assert.notCalled(removeEventsExceptInterventionsOnContractEnd);
      sinon.assert.notCalled(updateAbsencesOnContractEnd);
      sinon.assert.notCalled(updateEndDateStub);
      ContractMock.verify();
    }
  });
});

describe('createVersion', () => {
  let generateSignatureRequest;
  let ContractMock;
  beforeEach(() => {
    generateSignatureRequest = sinon.stub(ESignHelper, 'generateSignatureRequest');
    ContractMock = sinon.mock(Contract);
  });
  afterEach(() => {
    generateSignatureRequest.restore();
    ContractMock.restore();
  });

  it('should create version and update previous one', async () => {
    const newVersion = { startDate: new Date('2019-09-13T00:00:00') };
    const contract = {
      _id: new ObjectID(),
      startDate: '2019-09-09T00:00:00',
      versions: [{ startDate: '2019-09-01T00:00:00' }, { startDate: '2019-09-10T00:00:00' }],
    };

    ContractMock.expects('findOne')
      .withExactArgs({ _id: contract._id.toHexString() })
      .chain('lean')
      .once()
      .returns(contract);
    ContractMock.expects('updateOne')
      .withExactArgs(
        { _id: contract._id.toHexString() },
        {
          $set: { [`versions.${1}.endDate`]: moment('2019-09-13T00:00:00').subtract(1, 'd').endOf('d').toISOString() },
        }
      )
      .once();
    ContractMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: contract._id.toHexString() }, { $push: { versions: newVersion } })
      .chain('lean')
      .once();

    await ContractHelper.createVersion(contract._id.toHexString(), newVersion);

    ContractMock.verify();
    sinon.assert.notCalled(generateSignatureRequest);
  });

  it('should generate signature request', async () => {
    const newVersion = { startDate: '2019-09-10T00:00:00', signature: { templateId: '1234567890' } };
    const contract = { _id: new ObjectID(), startDate: '2019-09-09T00:00:00' };
    generateSignatureRequest.returns({ data: { document_hash: '1234567890' } });

    ContractMock.expects('findOne')
      .withExactArgs({ _id: contract._id.toHexString() })
      .chain('lean')
      .once()
      .returns(contract);
    ContractMock.expects('updateOne').never();
    ContractMock.expects('findOneAndUpdate')
      .withExactArgs(
        { _id: contract._id.toHexString() },
        { $push: { versions: { ...newVersion, signature: { eversignId: '1234567890' } } } }
      )
      .chain('lean')
      .once()
      .returns(contract);

    await ContractHelper.createVersion(contract._id.toHexString(), newVersion);

    ContractMock.verify();
    sinon.assert.calledWithExactly(generateSignatureRequest, { templateId: '1234567890' });
  });

  it('should throw on signature generation error', async () => {
    try {
      const contract = { _id: new ObjectID(), startDate: '2019-09-09T00:00:00' };
      const newVersion = { startDate: '2019-09-10T00:00:00', signature: { templateId: '1234567890' } };

      ContractMock.expects('findOne')
        .withExactArgs({ _id: contract._id.toHexString() })
        .chain('lean')
        .once()
        .returns(contract);
      ContractMock.expects('findOneAndUpdate').never();
      ContractMock.expects('updateOne').never();
      generateSignatureRequest.returns({ data: { error: { type: '1234567890' } } });

      await ContractHelper.createVersion(contract._id.toHexString(), newVersion);
    } catch (e) {
      expect(e.output.statusCode).toEqual(400);
    } finally {
      sinon.assert.calledWithExactly(generateSignatureRequest, { templateId: '1234567890' });
      ContractMock.verify();
    }
  });
});

describe('formatVersionEditionPayload', () => {
  let generateSignatureRequest;
  beforeEach(() => {
    generateSignatureRequest = sinon.stub(ESignHelper, 'generateSignatureRequest');
  });
  afterEach(() => {
    generateSignatureRequest.restore();
  });

  it('should update signatue payload', async () => {
    const oldVersion = { grossHourlyRate: 12, startDate: '2019-09-12T00:00:00' };
    const newVersion = { signature: { template: '12345' } };
    const versionIndex = 1;
    generateSignatureRequest.returns({ data: { document_hash: '567890' } });

    const result = await ContractHelper.formatVersionEditionPayload(oldVersion, newVersion, versionIndex);

    expect(result.$set['versions.1.signature.eversignId']).toEqual('567890');
    expect(result.$unset['versions.1.signature.signedBy']).toEqual('');
  });

  it('should throw error if signature request returns error', async () => {
    try {
      const oldVersion = { grossHourlyRate: 12, startDate: '2019-09-12T00:00:00' };
      const newVersion = { signature: { template: '12345' } };
      const versionIndex = 1;
      generateSignatureRequest.returns({ data: { error: '567890' } });

      await ContractHelper.formatVersionEditionPayload(oldVersion, newVersion, versionIndex);
    } catch (e) {
      expect(e.output.statusCode).toEqual(400);
    }
  });

  it('should not update signatue payload', async () => {
    const oldVersion = { grossHourlyRate: 12, startDate: '2019-09-12T00:00:00' };
    const newVersion = { grossHourlyRate: 15 };
    const versionIndex = 1;

    const result = await ContractHelper.formatVersionEditionPayload(oldVersion, newVersion, versionIndex);

    expect(result.$set['versions.1.grossHourlyRate']).toEqual(15);
    expect(result.$unset['versions.1.signature']).toEqual('');
  });

  it('should update customerArchives', async () => {
    const oldVersion = { startDate: '2019-09-12T00:00:00', customerDoc: '1234567890' };
    const newVersion = { grossHourlyRate: 15 };
    const versionIndex = 1;

    const result = await ContractHelper.formatVersionEditionPayload(oldVersion, newVersion, versionIndex);

    expect(result.$unset['versions.1.customerDoc']).toEqual('');
    expect(result.$push['versions.1.customerArchives']).toEqual('1234567890');
  });

  it('should update auxiliaryDoc', async () => {
    const oldVersion = { startDate: '2019-09-12T00:00:00', auxiliaryDoc: '1234567890' };
    const newVersion = { grossHourlyRate: 15 };
    const versionIndex = 1;

    const result = await ContractHelper.formatVersionEditionPayload(oldVersion, newVersion, versionIndex);

    expect(result.$unset['versions.1.auxiliaryDoc']).toEqual('');
    expect(result.$push['versions.1.auxiliaryArchives']).toEqual('1234567890');
  });

  it('should update previous version end date', async () => {
    const oldVersion = { startDate: '2019-09-12T00:00:00' };
    const newVersion = { startDate: '2019-09-16T00:00:00' };
    const versionIndex = 1;

    const result = await ContractHelper.formatVersionEditionPayload(oldVersion, newVersion, versionIndex);

    expect(result.$set['versions.0.endDate']).toEqual('2019-09-15T21:59:59.999Z');
  });

  it('should update contract start date', async () => {
    const oldVersion = { startDate: '2019-09-12T00:00:00', auxiliaryDoc: '1234567890' };
    const newVersion = { startDate: '2019-09-16T00:00:00' };
    const versionIndex = 0;

    const result = await ContractHelper.formatVersionEditionPayload(oldVersion, newVersion, versionIndex);

    expect(result.$set.startDate).toEqual('2019-09-16T00:00:00');
  });
});

describe('updateVersion', () => {
  const contractId = new ObjectID();
  const versionId = new ObjectID();
  const credentials = { company: { _id: new ObjectID() } };
  const companyId = credentials.company._id;
  let ContractMock;
  let canUpdateVersion;
  let formatVersionEditionPayload;
  let updateHistoryOnContractUpdateStub;
  beforeEach(() => {
    ContractMock = sinon.mock(Contract);
    canUpdateVersion = sinon.stub(ContractHelper, 'canUpdateVersion');
    formatVersionEditionPayload = sinon.stub(ContractHelper, 'formatVersionEditionPayload');
    updateHistoryOnContractUpdateStub = sinon.stub(SectorHistoryHelper, 'updateHistoryOnContractUpdate');
  });
  afterEach(() => {
    ContractMock.restore();
    formatVersionEditionPayload.restore();
    canUpdateVersion.restore();
    updateHistoryOnContractUpdateStub.restore();
  });

  it('should update version', async () => {
    const versionToUpdate = {
      _id: versionId,
      startDate: '2019-09-10T00:00:00',
      signature: { templateId: '1234567890' },
    };
    const contract = {
      startDate: '2019-09-09T00:00:00',
      versions: [{ _id: versionId, startDate: '2019-09-10T00:00:00', auxiliaryDoc: 'toto' }],
    };
    canUpdateVersion.returns(true);
    formatVersionEditionPayload.returns({ $set: {}, $push: {} });
    ContractMock.expects('findOne')
      .withExactArgs({ _id: contractId.toHexString() })
      .chain('lean')
      .once()
      .returns(contract);
    ContractMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: contractId.toHexString() }, { $set: {}, $push: {} })
      .chain('lean')
      .once()
      .returns(contract);

    updateHistoryOnContractUpdateStub.returns();

    await ContractHelper.updateVersion(contractId.toHexString(), versionId.toHexString(), versionToUpdate, credentials);

    sinon.assert.calledWithExactly(canUpdateVersion, contract, versionToUpdate, 0, companyId);
    sinon.assert.calledWithExactly(
      formatVersionEditionPayload,
      { _id: versionId, startDate: '2019-09-10T00:00:00', auxiliaryDoc: 'toto' },
      versionToUpdate,
      0
    );
    sinon.assert.calledWithExactly(
      updateHistoryOnContractUpdateStub,
      contractId.toHexString(),
      versionToUpdate,
      companyId
    );
    ContractMock.verify();
  });

  it('should update version and unset', async () => {
    const versionToUpdate = {
      _id: versionId,
      startDate: '2019-09-10T00:00:00',
      signature: { templateId: '1234567890' },
    };
    const contract = {
      startDate: '2019-09-09T00:00:00',
      versions: [
        { _id: new ObjectID(), startDate: '2019-07-10T00:00:00', auxiliaryDoc: 'Tutu' },
        { _id: versionId, startDate: '2019-09-10T00:00:00', auxiliaryDoc: 'toto' }
      ],
    };
    canUpdateVersion.returns(true);
    formatVersionEditionPayload.returns({ $set: {}, $push: {}, $unset: { customerDoc: '' } });
    ContractMock.expects('findOne')
      .withExactArgs({ _id: contractId.toHexString() })
      .chain('lean')
      .once()
      .returns(contract);
    ContractMock.expects('updateOne')
      .withExactArgs({ _id: contractId.toHexString() }, { $unset: { customerDoc: '' } })
      .once();
    ContractMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: contractId.toHexString() }, { $set: {}, $push: {} })
      .chain('lean')
      .once()
      .returns(contract);

    await ContractHelper.updateVersion(contractId.toHexString(), versionId.toHexString(), versionToUpdate, credentials);

    sinon.assert.calledWithExactly(canUpdateVersion, contract, versionToUpdate, 1, companyId);
    sinon.assert.calledWithExactly(
      formatVersionEditionPayload,
      { _id: versionId, startDate: '2019-09-10T00:00:00', auxiliaryDoc: 'toto' },
      versionToUpdate,
      1
    );
    sinon.assert.notCalled(updateHistoryOnContractUpdateStub);
    ContractMock.verify();
  });

  it('should update first version and contract', async () => {
    try {
      const versionToUpdate = { _id: versionId, startDate: '2019-09-10T00:00:00' };
      const contract = {
        startDate: '2019-09-09T00:00:00',
        versions: [{ _id: versionId, startDate: '2019-09-10T00:00:00' }],
      };
      ContractMock.expects('findOne')
        .chain('lean')
        .once()
        .returns(contract);
      ContractMock.expects('findOneAndUpdate').never();
      canUpdateVersion.returns(false);
      updateHistoryOnContractUpdateStub.returns();

      await ContractHelper.updateVersion(
        contractId.toHexString(),
        versionId.toHexString(),
        versionToUpdate,
        companyId
      );
      sinon.assert.calledWithExactly(
        updateHistoryOnContractUpdateStub,
        contractId.toHexString(),
        versionToUpdate,
        companyId
      );
    } catch (e) {
      expect(e.output.statusCode).toEqual(422);
    } finally {
      sinon.assert.notCalled(formatVersionEditionPayload);
      ContractMock.verify();
    }
  });
});

describe('deleteVersion', () => {
  let findOneContract;
  let saveContract;
  let deleteOne;
  let updateOneCustomer;
  let updateOneUser;
  let deleteFile;
  let countAuxiliaryEventsBetweenDates;
  let updateHistoryOnContractDeletionStub;
  const versionId = new ObjectID();
  const contractId = new ObjectID();
  const credentials = { company: { _id: new ObjectID() } };
  beforeEach(() => {
    findOneContract = sinon.stub(Contract, 'findOne');
    saveContract = sinon.stub(Contract.prototype, 'save');
    deleteOne = sinon.stub(Contract, 'deleteOne');
    updateOneCustomer = sinon.stub(Customer, 'updateOne');
    updateOneUser = sinon.stub(User, 'updateOne');
    deleteFile = sinon.stub(GDriveStorageHelper, 'deleteFile');
    countAuxiliaryEventsBetweenDates = sinon.stub(EventRepository, 'countAuxiliaryEventsBetweenDates');
    updateHistoryOnContractDeletionStub = sinon.stub(SectorHistoryHelper, 'updateHistoryOnContractDeletion');
  });
  afterEach(() => {
    findOneContract.restore();
    saveContract.restore();
    deleteOne.restore();
    updateOneCustomer.restore();
    updateOneUser.restore();
    deleteFile.restore();
    countAuxiliaryEventsBetweenDates.restore();
    updateHistoryOnContractDeletionStub.restore();
  });

  it('should delete contract', async () => {
    const contract = {
      _id: contractId,
      startDate: '2019-09-09',
      status: 'ok',
      user: 'toot',
      versions: [{ _id: versionId, auxiliaryDoc: { driveId: '123456789' } }],
    };
    countAuxiliaryEventsBetweenDates.returns(0);
    findOneContract.returns(contract);
    updateHistoryOnContractDeletionStub.returns();
    await ContractHelper.deleteVersion(contractId.toHexString(), versionId.toHexString(), credentials);
    sinon.assert.calledWithExactly(findOneContract, { _id: contractId.toHexString(), 'versions.0': { $exists: true } });
    sinon.assert.calledWithExactly(countAuxiliaryEventsBetweenDates, {
      auxiliary: 'toot',
      startDate: '2019-09-09',
      status: 'ok',
      company: credentials.company._id,
    });
    sinon.assert.notCalled(saveContract);
    sinon.assert.calledWithExactly(deleteOne, { _id: contractId.toHexString() });
    sinon.assert.calledWithExactly(updateOneUser, { _id: 'toot' }, { $pull: { contracts: contractId } });
    sinon.assert.notCalled(updateOneCustomer);
    sinon.assert.calledWithExactly(deleteFile, '123456789');
    sinon.assert.calledWithExactly(updateHistoryOnContractDeletionStub, contract, credentials.company._id);
  });

  it('should throw forbidden error as deletion is not allowed', async () => {
    try {
      const contract = {
        _id: contractId,
        user: 'toot',
        versions: [{ _id: versionId, auxiliaryDoc: { driveId: '123456789' } }],
      };
      countAuxiliaryEventsBetweenDates.returns(1);
      findOneContract.returns(contract);

      await ContractHelper.deleteVersion(contractId.toHexString(), versionId.toHexString(), credentials);
    } catch (e) {
      expect(e.output.statusCode).toEqual(403);
    } finally {
      sinon.assert.calledWithExactly(findOneContract, {
        _id: contractId.toHexString(),
        'versions.0': { $exists: true },
      });
      sinon.assert.notCalled(saveContract);
      sinon.assert.called(countAuxiliaryEventsBetweenDates);
      sinon.assert.notCalled(deleteOne);
      sinon.assert.notCalled(updateOneUser);
      sinon.assert.notCalled(updateOneCustomer);
      sinon.assert.notCalled(deleteFile);
      sinon.assert.notCalled(updateHistoryOnContractDeletionStub);
    }
  });

  it('should delete version and update previous version for company contract', async () => {
    const contract = new Contract({
      _id: contractId,
      user: 'toot',
      versions: [{ _id: new ObjectID() }, { _id: versionId, customerDoc: { driveId: '123456789' } }],
    });
    findOneContract.returns(contract);

    await ContractHelper.deleteVersion(contractId.toHexString(), versionId.toHexString(), credentials);
    sinon.assert.calledWithExactly(findOneContract, { _id: contractId.toHexString(), 'versions.0': { $exists: true } });
    sinon.assert.called(saveContract);
    sinon.assert.notCalled(deleteOne);
    sinon.assert.notCalled(updateOneUser);
    sinon.assert.notCalled(updateOneCustomer);
    sinon.assert.calledWithExactly(deleteFile, '123456789');
    sinon.assert.notCalled(updateHistoryOnContractDeletionStub);
  });

  it('should delete customer contract', async () => {
    const contract = {
      _id: contractId,
      user: 'toot',
      customer: 'qwer',
      versions: [{ _id: versionId, auxiliaryDoc: { driveId: '123456789' } }],
    };
    findOneContract.returns(contract);
    updateHistoryOnContractDeletionStub.returns();

    await ContractHelper.deleteVersion(contractId.toHexString(), versionId.toHexString(), credentials);
    sinon.assert.calledWithExactly(findOneContract, { _id: contractId.toHexString(), 'versions.0': { $exists: true } });
    sinon.assert.notCalled(saveContract);
    sinon.assert.calledWithExactly(deleteOne, { _id: contractId.toHexString() });
    sinon.assert.calledWithExactly(updateOneUser, { _id: 'toot' }, { $pull: { contracts: contractId } });
    sinon.assert.calledWithExactly(updateOneCustomer, { _id: 'qwer' }, { $pull: { contracts: contractId } });
    sinon.assert.calledWithExactly(deleteFile, '123456789');
    sinon.assert.calledWithExactly(updateHistoryOnContractDeletionStub, contract, credentials.company._id);
  });
});

describe('getContractInfo', () => {
  let getDaysRatioBetweenTwoDates;
  beforeEach(() => {
    getDaysRatioBetweenTwoDates = sinon.stub(UtilsHelper, 'getDaysRatioBetweenTwoDates');
  });
  afterEach(() => {
    getDaysRatioBetweenTwoDates.restore();
  });

  it('Case 1. One version no sunday', () => {
    const versions = [{ endDate: '', startDate: '2019-05-04', weeklyHours: 20 }];
    const query = { startDate: '2019-06-03', endDate: '2019-06-07' };
    getDaysRatioBetweenTwoDates.returns({ businessDays: 4, sundays: 0, holidays: 0 });

    const result = ContractHelper.getContractInfo(versions, query, { businessDays: 10, sundays: 0, holidays: 0 });

    expect(result).toBeDefined();
    expect(result.contractHours).toBe(8);
    expect(result.workedDaysRatio).toBe(0.4);
    expect(result.holidaysHours).toBe(0);
    sinon.assert.calledWithExactly(
      getDaysRatioBetweenTwoDates,
      moment('2019-06-03').toDate(),
      moment('2019-06-07').toDate()
    );
  });

  it('Case 2. One version and sunday included', () => {
    const versions = [{ endDate: '', startDate: '2019-05-04', weeklyHours: 24 }];
    const query = { startDate: '2019-06-03', endDate: '2019-06-09' };
    getDaysRatioBetweenTwoDates.returns({ businessDays: 4, sundays: 1, holidays: 0 });

    const result = ContractHelper.getContractInfo(versions, query, { businessDays: 10, sundays: 0, holidays: 0 });

    expect(result).toBeDefined();
    sinon.assert.calledWithExactly(
      getDaysRatioBetweenTwoDates,
      moment('2019-06-03')
        .startOf('d')
        .toDate(),
      moment('2019-06-09').toDate()
    );
  });

  it('Case 3. Multiple versions', () => {
    const versions = [
      { startDate: '2019-01-01', endDate: '2019-07-04', weeklyHours: 18 },
      { endDate: '', startDate: '2019-07-04', weeklyHours: 24 },
    ];
    const query = { startDate: '2019-06-27', endDate: '2019-07-05' };
    getDaysRatioBetweenTwoDates.returns({ businessDays: 4, sundays: 1, holidays: 0 });

    const result = ContractHelper.getContractInfo(versions, query, { businessDays: 10, sundays: 0, holidays: 0 });

    expect(result).toBeDefined();
    sinon.assert.calledTwice(getDaysRatioBetweenTwoDates);
  });

  it('Case 4. One version and holiday included', () => {
    const versions = [{ endDate: '', startDate: '2019-05-04', weeklyHours: 24 }];
    const query = { startDate: '2019-05-04', endDate: '2019-05-10' };
    getDaysRatioBetweenTwoDates.returns({ businessDays: 4, sundays: 0, holidays: 1 });

    const result = ContractHelper.getContractInfo(versions, query, { businessDays: 10, sundays: 0, holidays: 0 });

    expect(result).toBeDefined();
    expect(result.contractHours).toBe(12);
    expect(result.workedDaysRatio).toBe(0.5);
    expect(result.holidaysHours).toBe(4);
    sinon.assert.calledWithExactly(
      getDaysRatioBetweenTwoDates,
      moment('2019-05-04')
        .startOf('d')
        .toDate(),
      moment('2019-05-10').toDate()
    );
  });
});

describe('uploadFile', () => {
  let createAndSaveFileStub;
  beforeEach(() => {
    createAndSaveFileStub = sinon.stub(ContractHelper, 'createAndSaveFile');
  });
  afterEach(() => {
    createAndSaveFileStub.restore();
  });

  it('should upload a file', async () => {
    const params = { driveId: 'fakeDriveId', _id: new ObjectID() };
    const payload = {
      file: 'test',
      type: 'signedContract',
      fileName: 'test',
      customer: '12345',
      status: 'test',
      versionId: '12345',
    };
    createAndSaveFileStub.returns({ name: 'test' });
    const version = {
      customer: payload.customer,
      contractId: params._id,
      _id: payload.versionId,
      status: payload.status,
    };
    const fileInfo = {
      auxiliaryDriveId: params.driveId,
      name: payload.fileName,
      type: payload['Content-Type'],
      body: payload.file,
    };
    const result = await ContractHelper.uploadFile(params, payload);
    expect(result).toBeDefined();
    expect(result).toEqual({ name: 'test' });
    sinon.assert.calledWithExactly(createAndSaveFileStub, version, fileInfo);
  });
});
