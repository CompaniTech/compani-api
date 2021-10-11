const { ObjectID } = require('mongodb');
const Boom = require('@hapi/boom');
const expect = require('expect');
const sinon = require('sinon');
const moment = require('moment');
const FundingHistory = require('../../../src/models/FundingHistory');
const CreditNoteNumber = require('../../../src/models/CreditNoteNumber');
const CreditNote = require('../../../src/models/CreditNote');
const Company = require('../../../src/models/Company');
const Event = require('../../../src/models/Event');
const CreditNoteHelper = require('../../../src/helpers/creditNotes');
const UtilsHelper = require('../../../src/helpers/utils');
const translate = require('../../../src/helpers/translate');
const PdfHelper = require('../../../src/helpers/pdf');
const BillSlipHelper = require('../../../src/helpers/billSlips');
const SubscriptionHelper = require('../../../src/helpers/subscriptions');
const CreditNotePdf = require('../../../src/data/pdf/billing/creditNote');
const { COMPANI, OGUST } = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

const { language } = translate;

describe('getCreditNotes', () => {
  let getDateQueryStub;
  let find;
  let populateSubscriptionsServicesStub;
  const companyId = new ObjectID();
  const credentials = { company: { _id: companyId } };
  const customerId = new ObjectID();

  beforeEach(() => {
    getDateQueryStub = sinon.stub(UtilsHelper, 'getDateQuery');
    populateSubscriptionsServicesStub = sinon.stub(SubscriptionHelper, 'populateSubscriptionsServices');
    find = sinon.stub(CreditNote, 'find');
  });
  afterEach(() => {
    getDateQueryStub.restore();
    find.restore();
    populateSubscriptionsServicesStub.restore();
  });

  it('should get all credit notes', async () => {
    const payload = {
      customer: customerId,
      startDate: '2019-07-30T00:00:00',
      endDate: '2019-08-30T00:00:00',
    };
    const dateQuery = {
      $lte: moment(payload.endDate).endOf('day').toISOString(),
      $gte: moment(payload.startDate).startOf('day').toISOString(),
    };

    getDateQueryStub.returns(dateQuery);
    find.returns(SinonMongoose.stubChainedQueries([[{ customer: { _id: customerId } }]]));
    populateSubscriptionsServicesStub.returns({ _id: customerId, firstname: 'toto' });

    const result = await CreditNoteHelper.getCreditNotes(payload, credentials);

    expect(result).toEqual([{ customer: { _id: customerId, firstname: 'toto' } }]);
    sinon.assert.calledOnceWithExactly(getDateQueryStub, { startDate: payload.startDate, endDate: payload.endDate });
    SinonMongoose.calledWithExactly(
      find,
      [
        { query: 'find', args: [{ date: dateQuery, customer: customerId, company: companyId }] },
        {
          query: 'populate',
          args: [{
            path: 'customer',
            select: '_id identity subscriptions archivedAt',
            populate: { path: 'subscriptions.service' },
          }],
        },
        { query: 'populate', args: [{ path: 'thirdPartyPayer', select: '_id name' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(populateSubscriptionsServicesStub, { _id: customerId });
  });

  it('should not call getDateQuery if no date in payload', async () => {
    const payload = {
      customer: customerId,
    };

    find.returns(SinonMongoose.stubChainedQueries([[{ customer: { _id: customerId } }]]));
    populateSubscriptionsServicesStub.returns({ _id: customerId, firstname: 'toto' });

    const result = await CreditNoteHelper.getCreditNotes(payload, credentials);

    expect(result).toEqual([{ customer: { _id: customerId, firstname: 'toto' } }]);
    sinon.assert.notCalled(getDateQueryStub);
    SinonMongoose.calledWithExactly(
      find,
      [
        { query: 'find', args: [{ customer: customerId, company: companyId }] },
        {
          query: 'populate',
          args: [{
            path: 'customer',
            select: '_id identity subscriptions archivedAt',
            populate: { path: 'subscriptions.service' },
          }],
        },
        { query: 'populate', args: [{ path: 'thirdPartyPayer', select: '_id name' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(populateSubscriptionsServicesStub, { _id: customerId });
  });

  it('should not call populateSubscriptionsService if no creditNotes', async () => {
    const payload = {
      customer: customerId,
      startDate: '2019-07-30T00:00:00',
      endDate: '2019-08-30T00:00:00',
    };
    const dateQuery = {
      $lte: moment(payload.endDate).endOf('day').toISOString(),
      $gte: moment(payload.startDate).startOf('day').toISOString(),
    };

    getDateQueryStub.returns(dateQuery);
    find.returns(SinonMongoose.stubChainedQueries([[]]));

    const result = await CreditNoteHelper.getCreditNotes(payload, credentials);

    expect(result).toEqual([]);
    sinon.assert.calledOnceWithExactly(getDateQueryStub, { startDate: payload.startDate, endDate: payload.endDate });
    SinonMongoose.calledWithExactly(
      find,
      [
        { query: 'find', args: [{ date: dateQuery, customer: customerId, company: companyId }] },
        {
          query: 'populate',
          args: [{
            path: 'customer',
            select: '_id identity subscriptions archivedAt',
            populate: { path: 'subscriptions.service' },
          }],
        },
        { query: 'populate', args: [{ path: 'thirdPartyPayer', select: '_id name' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(populateSubscriptionsServicesStub);
  });
});

describe('updateEventAndFundingHistory', () => {
  let findOneAndUpdate;
  let updateOneFundingHistory;
  let find;
  let updateOneEvent;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(FundingHistory, 'findOneAndUpdate');
    updateOneFundingHistory = sinon.stub(FundingHistory, 'updateOne');
    find = sinon.stub(Event, 'find');
    updateOneEvent = sinon.stub(Event, 'updateOne');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
    updateOneFundingHistory.restore();
    find.restore();
    updateOneEvent.restore();
  });

  it('should increment history for hourly and once funding', async () => {
    const fundingId = new ObjectID();
    const credentials = { company: { _id: new ObjectID() } };
    const events = [{
      _id: new ObjectID(),
      company: new ObjectID(),
      bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
      startDate: new Date('2019/01/19'),
    }];

    find.returns(events);
    findOneAndUpdate.returns(null);
    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));

    await CreditNoteHelper.updateEventAndFundingHistory([], false, credentials);

    sinon.assert.calledOnceWithExactly(findOneAndUpdate, { fundingId, month: '01/2019' }, { $inc: { careHours: -3 } });
    sinon.assert.calledOnceWithExactly(updateOneEvent, { _id: events[0]._id }, { isBilled: false });
    sinon.assert.calledOnceWithExactly(updateOneFundingHistory, { fundingId }, { $inc: { careHours: -3 } });
    SinonMongoose.calledWithExactly(
      find,
      [{ query: 'find', args: [{ _id: { $in: [] }, company: credentials.company._id }] }, { query: 'lean' }]
    );
  });

  it('should increment history for hourly and monthly funding', async () => {
    const fundingId = new ObjectID();
    const credentials = { company: { _id: new ObjectID() } };
    const events = [{
      _id: new ObjectID(),
      company: new ObjectID(),
      bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
      startDate: new Date('2019/01/19'),
    }];

    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));
    findOneAndUpdate.returns(new FundingHistory());

    await CreditNoteHelper.updateEventAndFundingHistory([], false, credentials);

    sinon.assert.calledOnceWithExactly(findOneAndUpdate, { fundingId, month: '01/2019' }, { $inc: { careHours: -3 } });
    sinon.assert.calledOnceWithExactly(updateOneEvent, { _id: events[0]._id }, { isBilled: false });
    sinon.assert.notCalled(updateOneFundingHistory);
    SinonMongoose.calledWithExactly(
      find,
      [{ query: 'find', args: [{ _id: { $in: [] }, company: credentials.company._id }] }, { query: 'lean' }]
    );
  });

  it('should decrement history for hourly and monthly funding', async () => {
    const fundingId = new ObjectID();
    const credentials = { company: { _id: new ObjectID() } };
    const events = [{
      _id: new ObjectID(),
      company: new ObjectID(),
      bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
      startDate: new Date('2019/01/19'),
    }];

    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));
    findOneAndUpdate.returns(null);

    await CreditNoteHelper.updateEventAndFundingHistory([], true, credentials);

    sinon.assert.calledOnceWithExactly(findOneAndUpdate, { fundingId, month: '01/2019' }, { $inc: { careHours: 3 } });
    sinon.assert.calledOnceWithExactly(updateOneEvent, { _id: events[0]._id }, { isBilled: true });
    sinon.assert.calledOnceWithExactly(updateOneFundingHistory, { fundingId }, { $inc: { careHours: 3 } });
    SinonMongoose.calledWithExactly(
      find,
      [{ query: 'find', args: [{ _id: { $in: [] }, company: credentials.company._id }] }, { query: 'lean' }]
    );
  });

  it('should increment history for fixed and once funding', async () => {
    const fundingId = new ObjectID();
    const eventId = new ObjectID();
    const credentials = { company: { _id: new ObjectID() } };
    const eventsToUpdate = [{ eventId }];
    const events = [{
      _id: new ObjectID(),
      company: new ObjectID(),
      bills: { nature: 'fixed', fundingId, thirdPartyPayer: new ObjectID(), inclTaxesTpp: 666 },
      startDate: new Date('2019/01/19'),
    }];

    find.returns(SinonMongoose.stubChainedQueries([events], ['lean']));

    await CreditNoteHelper.updateEventAndFundingHistory(eventsToUpdate, false, credentials);

    sinon.assert.calledOnceWithExactly(updateOneFundingHistory, { fundingId }, { $inc: { amountTTC: -666 } });
    sinon.assert.calledOnceWithExactly(updateOneEvent, { _id: events[0]._id }, { isBilled: false });
    SinonMongoose.calledWithExactly(
      find,
      [{ query: 'find', args: [{ _id: { $in: [eventId] }, company: credentials.company._id }] }, { query: 'lean' }]
    );
  });
});

describe('formatCreditNoteNumber', () => {
  it('should return the correct credit note number', () => {
    expect(CreditNoteHelper.formatCreditNoteNumber(12345, 'toto', 5)).toEqual('AV-12345toto00005');
    expect(CreditNoteHelper.formatCreditNoteNumber(12345, 'toto', 12345)).toEqual('AV-12345toto12345');
  });
});

describe('formatCreditNote', () => {
  let formatCreditNoteNumber;
  let getFixedNumber;
  beforeEach(() => {
    formatCreditNoteNumber = sinon.stub(CreditNoteHelper, 'formatCreditNoteNumber');
    getFixedNumber = sinon.stub(UtilsHelper, 'getFixedNumber');
  });
  afterEach(() => {
    formatCreditNoteNumber.restore();
    getFixedNumber.restore();
  });

  it('should format credit note with number', async () => {
    const payload = {};
    const companyPrefix = 12345;
    const prefix = 12;
    const seq = 432;
    formatCreditNoteNumber.returns('number');

    await CreditNoteHelper.formatCreditNote(payload, companyPrefix, prefix, seq);
    sinon.assert.calledOnceWithExactly(formatCreditNoteNumber, companyPrefix, prefix, seq);
    sinon.assert.notCalled(getFixedNumber);
  });
  it('should format credit note for customer', async () => {
    const payload = { inclTaxesCustomer: 98 };
    const companyPrefix = 12345;
    const prefix = 12;
    const seq = 432;
    formatCreditNoteNumber.returns('number');
    getFixedNumber.returnsArg(0);

    const creditNote = await CreditNoteHelper.formatCreditNote(payload, companyPrefix, prefix, seq);
    sinon.assert.calledOnceWithExactly(formatCreditNoteNumber, companyPrefix, prefix, seq);
    sinon.assert.calledOnceWithExactly(getFixedNumber, 98, 2);
    expect(creditNote.number).toEqual('number');
    expect(creditNote.inclTaxesCustomer).toEqual(98);
  });
  it('should format credit note for third party payer', async () => {
    const payload = { inclTaxesTpp: 98 };
    const companyPrefix = 12345;
    const prefix = 12;
    const seq = 432;
    formatCreditNoteNumber.returns('number');
    getFixedNumber.returnsArg(0);

    const creditNote = await CreditNoteHelper.formatCreditNote(payload, companyPrefix, prefix, seq);
    sinon.assert.calledOnceWithExactly(formatCreditNoteNumber, companyPrefix, prefix, seq);
    sinon.assert.calledOnceWithExactly(getFixedNumber, 98, 2);
    expect(creditNote.number).toEqual('number');
    expect(creditNote.inclTaxesTpp).toEqual(98);
  });
});

describe('getCreditNoteNumber', () => {
  let findOneAndUpdate;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(CreditNoteNumber, 'findOneAndUpdate');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
  });

  it('should get credit note number', async () => {
    const payload = { date: '2019-09-19T00:00:00' };
    const company = { _id: new ObjectID() };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries([], ['lean']));

    await CreditNoteHelper.getCreditNoteNumber(payload, company._id);

    SinonMongoose.calledWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'find',
          args: [
            { prefix: '0919', company: company._id },
            {},
            { new: true, upsert: true, setDefaultsOnInsert: true },
          ],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('createCreditNotes', () => {
  let updateOneNumber;
  let formatCreditNote;
  let insertManyCreditNote;
  let updateEventAndFundingHistory;
  let getCreditNoteNumber;
  let createBillSlips;
  const credentials = { company: { _id: new ObjectID(), prefixNumber: 'prefixNumber' } };
  const prefix = 'AV-0719';

  beforeEach(() => {
    getCreditNoteNumber = sinon.stub(CreditNoteHelper, 'getCreditNoteNumber');
    updateOneNumber = sinon.stub(CreditNoteNumber, 'updateOne');
    formatCreditNote = sinon.stub(CreditNoteHelper, 'formatCreditNote');
    insertManyCreditNote = sinon.stub(CreditNote, 'insertMany');
    updateEventAndFundingHistory = sinon.stub(CreditNoteHelper, 'updateEventAndFundingHistory');
    createBillSlips = sinon.stub(BillSlipHelper, 'createBillSlips');
  });
  afterEach(() => {
    getCreditNoteNumber.restore();
    updateOneNumber.restore();
    formatCreditNote.restore();
    insertManyCreditNote.restore();
    updateEventAndFundingHistory.restore();
    createBillSlips.restore();
  });

  it('should create one credit note (for customer)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesCustomer: 123,
      thirdPartyPayer: 'qwertyuiop',
    };
    getCreditNoteNumber.returns({ seq: 1, prefix });
    formatCreditNote.returns({ inclTaxesCustomer: 1234 });

    await CreditNoteHelper.createCreditNotes(payload, credentials);

    sinon.assert.calledOnceWithExactly(
      formatCreditNote,
      {
        date: '2019-07-30T00:00:00',
        inclTaxesCustomer: 123,
        exclTaxesTpp: 0,
        inclTaxesTpp: 0,
        company: credentials.company._id,
      },
      'prefixNumber',
      prefix,
      1
    );
    sinon.assert.calledOnceWithExactly(insertManyCreditNote, [{ inclTaxesCustomer: 1234 }]);
    sinon.assert.calledOnceWithExactly(
      createBillSlips,
      [{ inclTaxesCustomer: 1234 }], payload.date, credentials.company
    );
    sinon.assert.notCalled(updateEventAndFundingHistory);
    sinon.assert.calledOnceWithExactly(getCreditNoteNumber, payload, credentials.company._id);
    sinon.assert.calledOnceWithExactly(
      updateOneNumber,
      { prefix, company: credentials.company._id }, { $set: { seq: 2 } }
    );
  });

  it('should create one credit note (for tpp)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesTpp: 123,
      thirdPartyPayer: 'qwertyuiop',
      events: [{ _id: 'asdfghjkl' }],
    };
    getCreditNoteNumber.returns({ seq: 1, prefix });
    formatCreditNote.returns({ inclTaxesTpp: 1234 });

    await CreditNoteHelper.createCreditNotes(payload, credentials);

    sinon.assert.calledOnceWithExactly(
      formatCreditNote,
      {
        date: '2019-07-30T00:00:00',
        events: [{ _id: 'asdfghjkl' }],
        inclTaxesTpp: 123,
        thirdPartyPayer: 'qwertyuiop',
        exclTaxesCustomer: 0,
        inclTaxesCustomer: 0,
        company: credentials.company._id,
      },
      'prefixNumber',
      prefix,
      1
    );
    sinon.assert.calledOnceWithExactly(insertManyCreditNote, [{ inclTaxesTpp: 1234 }]);
    sinon.assert.calledOnceWithExactly(createBillSlips, [{ inclTaxesTpp: 1234 }], payload.date, credentials.company);
    sinon.assert.calledOnceWithExactly(updateEventAndFundingHistory, [{ _id: 'asdfghjkl' }], false, credentials);
    sinon.assert.calledOnceWithExactly(getCreditNoteNumber, payload, credentials.company._id);
    sinon.assert.calledOnceWithExactly(
      updateOneNumber,
      { prefix, company: credentials.company._id }, { $set: { seq: 2 } }
    );
  });

  it('should create two credit notes (for customer and tpp)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesTpp: 123,
      inclTaxesCustomer: 654,
      thirdPartyPayer: 'qwertyuiop',
    };
    getCreditNoteNumber.returns({ seq: 1, prefix });
    formatCreditNote.onCall(0).returns({ _id: '1234', inclTaxesCustomer: 32 });
    formatCreditNote.onCall(1).returns({ _id: '0987', inclTaxesTpp: 1234 });

    await CreditNoteHelper.createCreditNotes(payload, credentials);

    sinon.assert.calledWithExactly(
      formatCreditNote.getCall(0),
      {
        date: '2019-07-30T00:00:00',
        inclTaxesTpp: 123,
        thirdPartyPayer: 'qwertyuiop',
        exclTaxesCustomer: 0,
        inclTaxesCustomer: 0,
        company: credentials.company._id,
      },
      'prefixNumber',
      prefix,
      1
    );
    sinon.assert.calledWithExactly(
      formatCreditNote.getCall(1),
      {
        date: '2019-07-30T00:00:00',
        inclTaxesCustomer: 654,
        exclTaxesTpp: 0,
        inclTaxesTpp: 0,
        company: credentials.company._id,
      },
      'prefixNumber',
      prefix,
      2
    );
    sinon.assert.calledOnceWithExactly(
      insertManyCreditNote,
      [
        { _id: '0987', linkedCreditNote: '1234', inclTaxesTpp: 1234 },
        { _id: '1234', linkedCreditNote: '0987', inclTaxesCustomer: 32 },
      ]
    );
    sinon.assert.notCalled(updateEventAndFundingHistory);
    sinon.assert.calledOnceWithExactly(
      createBillSlips,
      [
        { _id: '0987', linkedCreditNote: '1234', inclTaxesTpp: 1234 },
        { _id: '1234', linkedCreditNote: '0987', inclTaxesCustomer: 32 },
      ],
      payload.date,
      credentials.company
    );
    sinon.assert.calledOnceWithExactly(getCreditNoteNumber, payload, credentials.company._id);
    sinon.assert.calledOnceWithExactly(
      updateOneNumber,
      { prefix, company: credentials.company._id }, { $set: { seq: 3 } }
    );
  });
});

describe('updateCreditNotes', () => {
  let updateEventAndFundingHistory;
  let findByIdAndUpdate;
  let updateOne;
  const creditNote = {
    _id: new ObjectID(),
    number: 1,
    events: [{
      auxiliary: { identity: { firstname: 'Nathanaelle', lastname: 'Tata' } },
      startDate: '2019-04-29T06:00:00.000Z',
      endDate: '2019-04-29T15:00:00.000Z',
      serviceName: 'Toto',
      bills: { inclTaxesCustomer: 234, exclTaxesCustomer: 221, surcharges: [{ percentage: 30 }] },
    }],
    customer: {
      identity: { firstname: 'Toto', lastname: 'Bobo', title: 'mr' },
      contact: { primaryAddress: { fullAddress: 'La ruche' } },
      subscriptions: [{ _id: new ObjectID(), service: { versions: [{ name: 'Toto' }] } }],
    },
    date: '2019-04-29T22:00:00.000Z',
    exclTaxesCustomer: 221,
    inclTaxesCustomer: 234,
    exclTaxesTpp: 21,
    inclTaxesTpp: 34,
  };
  const credentials = { company: { _id: new ObjectID() } };

  beforeEach(() => {
    updateEventAndFundingHistory = sinon.stub(CreditNoteHelper, 'updateEventAndFundingHistory');
    findByIdAndUpdate = sinon.stub(CreditNote, 'findByIdAndUpdate');
    updateOne = sinon.stub(CreditNote, 'updateOne');
  });

  afterEach(() => {
    updateEventAndFundingHistory.restore();
    findByIdAndUpdate.restore();
    updateOne.restore();
  });

  it('should update a credit note', async () => {
    findByIdAndUpdate.returns({ ...creditNote, date: '2020-04-29T22:00:00.000Z' });

    const result = await CreditNoteHelper.updateCreditNotes(
      creditNote,
      { date: '2020-04-29T22:00:00.000Z' },
      credentials
    );

    expect(result).toMatchObject({
      _id: creditNote._id,
      number: 1,
      events: [{
        auxiliary: { identity: { firstname: 'Nathanaelle', lastname: 'Tata' } },
        startDate: '2019-04-29T06:00:00.000Z',
        endDate: '2019-04-29T15:00:00.000Z',
        serviceName: 'Toto',
        bills: { inclTaxesCustomer: 234, exclTaxesCustomer: 221, surcharges: [{ percentage: 30 }] },
      }],
      customer: {
        identity: { firstname: 'Toto', lastname: 'Bobo', title: 'mr' },
        contact: { primaryAddress: { fullAddress: 'La ruche' } },
        subscriptions: [{ _id: creditNote.customer.subscriptions[0]._id, service: { versions: [{ name: 'Toto' }] } }],
      },
      exclTaxesCustomer: 221,
      inclTaxesCustomer: 234,
      exclTaxesTpp: 21,
      inclTaxesTpp: 34,
      date: '2020-04-29T22:00:00.000Z',
    });
    sinon.assert.calledOnceWithExactly(updateEventAndFundingHistory, creditNote.events, true, credentials);
    sinon.assert.calledOnceWithExactly(
      findByIdAndUpdate,
      creditNote._id,
      { $set: { date: '2020-04-29T22:00:00.000Z' } },
      { new: true }
    );
  });

  it('should update a customer credit note and its tpp linked credit note', async () => {
    const creditNoteWithLink = { ...creditNote, linkedCreditNote: new ObjectID() };
    const payload = {
      events: [{
        auxiliary: {
          identity: { firstname: 'Nathanaelle', lastname: 'Tata' },
        },
        startDate: '2019-04-30T06:00:00.000Z',
        endDate: '2019-04-30T15:00:00.000Z',
        serviceName: 'Toto',
        bills: { inclTaxesCustomer: 123, exclTaxesCustomer: 90 },
      }],
    };
    const updatedCreditNote = { ...creditNoteWithLink, events: payload.events };

    findByIdAndUpdate.returns(updatedCreditNote);

    const result = await CreditNoteHelper.updateCreditNotes(creditNoteWithLink, payload, credentials);

    expect(result).toMatchObject(updatedCreditNote);
    sinon.assert.calledWithExactly(
      updateEventAndFundingHistory.firstCall,
      creditNoteWithLink.events,
      true,
      credentials
    );
    sinon.assert.calledWithExactly(updateEventAndFundingHistory.secondCall, payload.events, false, credentials);
    sinon.assert.calledOnceWithExactly(
      findByIdAndUpdate,
      creditNote._id,
      { $set: { ...payload, inclTaxesTpp: 0, exclTaxesTpp: 0 } },
      { new: true }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: creditNoteWithLink.linkedCreditNote },
      { $set: { ...payload, inclTaxesCustomer: 0, exclTaxesCustomer: 0 } },
      { new: true }
    );
  });

  it('should update a tpp credit note and its customer linked credit note', async () => {
    const tppId = new ObjectID();
    const creditNoteWithLink = { ...creditNote, thirdPartyPayer: tppId, linkedCreditNote: new ObjectID() };
    const payload = {
      events: [{
        auxiliary: {
          identity: { firstname: 'Nathanaelle', lastname: 'Tata' },
        },
        startDate: '2019-04-30T06:00:00.000Z',
        endDate: '2019-04-30T15:00:00.000Z',
        serviceName: 'Toto',
        bills: { inclTaxesCustomer: 123, exclTaxesCustomer: 90 },
      }],
    };
    const updatedCreditNote = { ...creditNoteWithLink, events: payload.events };

    findByIdAndUpdate.returns(updatedCreditNote);

    const result = await CreditNoteHelper.updateCreditNotes(creditNoteWithLink, payload, credentials);
    expect(result).toMatchObject(updatedCreditNote);
    sinon.assert.calledWithExactly(
      updateEventAndFundingHistory.firstCall,
      creditNoteWithLink.events,
      true,
      credentials
    );
    sinon.assert.calledWithExactly(updateEventAndFundingHistory.secondCall, payload.events, false, credentials);
    sinon.assert.calledOnceWithExactly(
      findByIdAndUpdate,
      creditNote._id,
      { $set: { ...payload, inclTaxesCustomer: 0, exclTaxesCustomer: 0 } },
      { new: true }
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: creditNoteWithLink.linkedCreditNote },
      { $set: { ...payload, inclTaxesTpp: 0, exclTaxesTpp: 0 } },
      { new: true }
    );
  });
});

describe('formatPdf', () => {
  let getMatchingVersion;
  let formatPrice;
  let formatEventSurchargesForPdf;
  let formatIdentity;
  beforeEach(() => {
    getMatchingVersion = sinon.stub(UtilsHelper, 'getMatchingVersion').returns({ name: 'Toto' });
    formatPrice = sinon.stub(UtilsHelper, 'formatPrice');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    formatEventSurchargesForPdf = sinon.stub(PdfHelper, 'formatEventSurchargesForPdf');
  });
  afterEach(() => {
    getMatchingVersion.restore();
    formatPrice.restore();
    formatEventSurchargesForPdf.restore();
    formatIdentity.restore();
  });

  it('should format correct credit note pdf with events for customer', () => {
    const company = {
      name: 'Alcatraz',
      logo: 'company_logo',
      rcs: 'rcs',
      address: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
    };
    const subId = new ObjectID();
    const creditNote = {
      number: 1,
      events: [{
        auxiliary: { identity: { firstname: 'Nathanaelle', lastname: 'Tata' } },
        startDate: '2019-04-29T06:00:00.000Z',
        endDate: '2019-04-29T15:00:00.000Z',
        serviceName: 'Toto',
        bills: { inclTaxesCustomer: 234, exclTaxesCustomer: 221, surcharges: [{ percentage: 30 }] },
      }],
      customer: {
        identity: { firstname: 'Toto', lastname: 'Bobo', title: 'mr' },
        contact: { primaryAddress: { fullAddress: 'La ruche' } },
        subscriptions: [{ _id: subId, service: { versions: [{ name: 'Toto' }] } }],
      },
      date: '2019-04-29T22:00:00.000Z',
      exclTaxesCustomer: 221,
      inclTaxesCustomer: 234,
      exclTaxesTpp: 21,
      inclTaxesTpp: 34,
    };
    const expectedResult = {
      creditNote: {
        number: 1,
        customer: {
          identity: { firstname: 'Toto', lastname: 'Bobo', title: 'M.' },
          contact: { primaryAddress: { fullAddress: 'La ruche' } },
        },
        forTpp: false,
        date: moment('2019-04-29T22:00:00.000Z').format('DD/MM/YYYY'),
        totalExclTaxes: '221,00 €',
        netInclTaxes: '234,00 €',
        totalVAT: '13,00 €',
        formattedEvents: [
          {
            identity: 'N. Tata',
            date: moment('2019-04-29T06:00:00.000Z').format('DD/MM'),
            startTime: moment('2019-04-29T06:00:00.000Z').format('HH:mm'),
            endTime: moment('2019-04-29T15:00:00.000Z').format('HH:mm'),
            service: 'Toto',
            surcharges: [{ percentage: 30, startHour: '19h' }],
          },
        ],
        recipient: { name: 'M. Toto BOBO', address: { fullAddress: 'La ruche' } },
        company,
      },
    };

    formatPrice.onCall(0).returns('13,00 €');
    formatPrice.onCall(1).returns('221,00 €');
    formatPrice.onCall(2).returns('234,00 €');
    formatIdentity.returns('M. Toto BOBO');
    formatEventSurchargesForPdf.returns([{ percentage: 30, startHour: '19h' }]);

    const result = CreditNoteHelper.formatPdf(creditNote, company);

    expect(result).toEqual(expectedResult);
    sinon.assert.calledOnceWithExactly(formatEventSurchargesForPdf, [{ percentage: 30 }]);
  });

  it('should format correct credit note pdf with events for tpp', () => {
    const subId = new ObjectID();
    const creditNote = {
      number: 1,
      events: [{
        auxiliary: {
          identity: { firstname: 'Nathanaelle', lastname: 'Tata' },
        },
        startDate: '2019-04-29T06:00:00.000Z',
        endDate: '2019-04-29T15:00:00.000Z',
        serviceName: 'Toto',
        bills: { inclTaxesTpp: 234, exclTaxesTpp: 221 },
      }],
      customer: {
        identity: { firstname: 'Toto', lastname: 'Bobo', title: 'mrs' },
        contact: { primaryAddress: { fullAddress: 'La ruche' } },
        subscriptions: [{ _id: subId, service: { versions: [{ name: 'Toto' }] } }],
      },
      date: '2019-04-29T22:00:00.000Z',
      exclTaxesTpp: 21,
      inclTaxesTpp: 34,
      exclTaxesCustomer: 221,
      inclTaxesCustomer: 234,
      thirdPartyPayer: { name: 'tpp', address: { fullAddress: 'j\'habite ici' } },
    };
    const company = {
      name: 'Alcatraz',
      logo: 'company_logo',
      rcs: 'rcs',
      address: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
    };
    const expectedResult = {
      creditNote: {
        number: 1,
        customer: {
          identity: { firstname: 'Toto', lastname: 'Bobo', title: 'Mme' },
          contact: { primaryAddress: { fullAddress: 'La ruche' } },
        },
        forTpp: true,
        date: moment('2019-04-29T22:00:00.000Z').format('DD/MM/YYYY'),
        totalExclTaxes: '21,00 €',
        netInclTaxes: '34,00 €',
        totalVAT: '13,00 €',
        formattedEvents: [
          {
            identity: 'N. Tata',
            date: moment('2019-04-29T06:00:00.000Z').format('DD/MM'),
            startTime: moment('2019-04-29T06:00:00.000Z').format('HH:mm'),
            endTime: moment('2019-04-29T15:00:00.000Z').format('HH:mm'),
            service: 'Toto',
          },
        ],
        recipient: { name: 'tpp', address: { fullAddress: 'j\'habite ici' } },
        company,
      },
    };

    formatPrice.onCall(0).returns('13,00 €');
    formatPrice.onCall(1).returns('21,00 €');
    formatPrice.onCall(2).returns('34,00 €');

    const result = CreditNoteHelper.formatPdf(creditNote, company);

    expect(result).toBeDefined();
    expect(result).toEqual(expectedResult);
    sinon.assert.notCalled(formatEventSurchargesForPdf);
  });

  it('should format correct credit note pdf with subscription', () => {
    const creditNote = {
      number: 1,
      subscription: { service: { name: 'service' }, unitInclTaxes: 12 },
      customer: {
        identity: { firstname: 'Toto', lastname: 'Bobo', title: 'couple' },
        contact: { primaryAddress: { fullAddress: 'La ruche' } },
      },
      date: '2019-04-29T22:00:00.000Z',
      exclTaxesTpp: 21,
      inclTaxesTpp: 34,
      exclTaxesCustomer: 221,
      inclTaxesCustomer: 234,
      thirdPartyPayer: { name: 'tpp', address: { fullAddress: 'j\'habite ici' } },
    };
    const company = {
      name: 'Alcatraz',
      logo: 'company_logo',
      rcs: 'rcs',
      address: {
        fullAddress: '37 rue de ponthieu 75008 Paris',
        zipCode: '75008',
        city: 'Paris',
        street: '37 rue de Ponthieu',
        location: { type: 'Point', coordinates: [2.377133, 48.801389] },
      },
    };
    formatPrice.onCall(0).returns('12,00 €');

    const result = CreditNoteHelper.formatPdf(creditNote, company);

    expect(result).toBeDefined();
    expect(result.creditNote.subscription).toBeDefined();
    expect(result.creditNote.subscription.service).toBe('service');
    expect(result.creditNote.subscription.unitInclTaxes).toBe('12,00 €');
  });
});

describe('removeCreditNote', () => {
  let updateEventAndFundingHistoryStub;
  let deleteOneStub;
  const creditNote = {
    _id: new ObjectID(),
    number: 1,
    events: [{
      auxiliary: {
        identity: { firstname: 'Nathanaelle', lastname: 'Tata' },
      },
      startDate: '2019-04-29T06:00:00.000Z',
      endDate: '2019-04-29T15:00:00.000Z',
      serviceName: 'Toto',
      bills: { inclTaxesCustomer: 234, exclTaxesCustomer: 221, surcharges: [{ percentage: 30 }] },
    }],
    customer: {
      identity: { firstname: 'Toto', lastname: 'Bobo', title: 'mr' },
      contact: { primaryAddress: { fullAddress: 'La ruche' } },
      subscriptions: [{ _id: new ObjectID(), service: { versions: [{ name: 'Toto' }] } }],
    },
    date: '2019-04-29T22:00:00.000Z',
    exclTaxesCustomer: 221,
    inclTaxesCustomer: 234,
    exclTaxesTpp: 21,
    inclTaxesTpp: 34,
  };
  const credentials = { company: { _id: new ObjectID() } };
  const params = { _id: new ObjectID() };
  beforeEach(() => {
    updateEventAndFundingHistoryStub = sinon.stub(CreditNoteHelper, 'updateEventAndFundingHistory');
    deleteOneStub = sinon.stub(CreditNote, 'deleteOne');
  });

  afterEach(() => {
    updateEventAndFundingHistoryStub.restore();
    deleteOneStub.restore();
  });

  it('should delete a credit note', async () => {
    await CreditNoteHelper.removeCreditNote(creditNote, credentials, params);
    sinon.assert.calledOnceWithExactly(updateEventAndFundingHistoryStub, creditNote.events, true, credentials);
    sinon.assert.calledOnceWithExactly(deleteOneStub, { _id: params._id });
  });

  it('should delete the linked creditNote if it has one', async () => {
    creditNote.linkedCreditNote = new ObjectID();
    await CreditNoteHelper.removeCreditNote(creditNote, credentials, params);
    sinon.assert.calledOnceWithExactly(updateEventAndFundingHistoryStub, creditNote.events, true, credentials);
    expect(deleteOneStub.getCall(0).calledWithExactly(deleteOneStub, { _id: params._id }));
    expect(deleteOneStub.getCall(1).calledWithExactly(deleteOneStub, { _id: creditNote.linkedCreditNote }));
  });
});

describe('generateCreditNotePdf', () => {
  let creditNoteFindOne;
  let companyNoteFindOne;
  let formatPdf;
  let getPdfContent;
  let generatePdf;

  const params = { _id: new ObjectID() };
  const credentials = { company: { _id: new ObjectID() } };
  beforeEach(() => {
    creditNoteFindOne = sinon.stub(CreditNote, 'findOne');
    companyNoteFindOne = sinon.stub(Company, 'findOne');
    formatPdf = sinon.stub(CreditNoteHelper, 'formatPdf');
    getPdfContent = sinon.stub(CreditNotePdf, 'getPdfContent');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    creditNoteFindOne.restore();
    companyNoteFindOne.restore();
    formatPdf.restore();
    getPdfContent.restore();
    generatePdf.restore();
  });

  it('should generate a pdf', async () => {
    creditNoteFindOne.returns(SinonMongoose.stubChainedQueries([{ origin: COMPANI, number: '12345' }]));
    companyNoteFindOne.returns(SinonMongoose.stubChainedQueries([{ _id: credentials.company._id }], ['lean']));
    formatPdf.returns({ name: 'creditNotePdf' });
    getPdfContent.returns({ content: ['creditNotePdf'] });
    generatePdf.returns({ title: 'creditNote' });

    const result = await CreditNoteHelper.generateCreditNotePdf(params, credentials);

    expect(result).toEqual({ pdf: { title: 'creditNote' }, creditNoteNumber: '12345' });
    SinonMongoose.calledWithExactly(
      creditNoteFindOne,
      [
        { query: 'find', args: [{ _id: params._id }] },
        {
          query: 'populate',
          args: [{
            path: 'customer',
            select: '_id identity contact subscriptions',
            populate: { path: 'subscriptions.service' },
          }],
        },
        { query: 'populate', args: [{ path: 'thirdPartyPayer', select: '_id name address' }] },
        { query: 'populate', args: [{ path: 'events.auxiliary', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      companyNoteFindOne,
      [{ query: 'find', args: [{ _id: credentials.company._id }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(
      formatPdf,
      { origin: COMPANI, number: '12345' },
      { _id: credentials.company._id }
    );
    sinon.assert.calledOnceWithExactly(getPdfContent, { name: 'creditNotePdf' });
    sinon.assert.calledOnceWithExactly(generatePdf, { content: ['creditNotePdf'] });
  });

  it('should return a 404 if creditnote is not found', async () => {
    try {
      creditNoteFindOne.returns(SinonMongoose.stubChainedQueries([]));

      await CreditNoteHelper.generateCreditNotePdf(params, credentials);
    } catch (e) {
      expect(e).toEqual(Boom.notFound(translate[language].creditNoteNotFound));
    } finally {
      sinon.assert.notCalled(formatPdf);
      sinon.assert.notCalled(getPdfContent);
      sinon.assert.notCalled(generatePdf);
      SinonMongoose.calledWithExactly(
        creditNoteFindOne,
        [
          { query: 'find', args: [{ _id: params._id }] },
          {
            query: 'populate',
            args: [{
              path: 'customer',
              select: '_id identity contact subscriptions',
              populate: { path: 'subscriptions.service' },
            }],
          },
          { query: 'populate', args: [{ path: 'thirdPartyPayer', select: '_id name address' }] },
          { query: 'populate', args: [{ path: 'events.auxiliary', select: 'identity' }] },
          { query: 'lean' },
        ]
      );
    }
  });

  it('should return a 400 if creditnote origin is not compani', async () => {
    try {
      creditNoteFindOne.returns(SinonMongoose.stubChainedQueries([{ origin: OGUST }]));

      await CreditNoteHelper.generateCreditNotePdf(params, credentials);
    } catch (e) {
      expect(e).toEqual(Boom.badRequest(translate[language].creditNoteNotCompani));
    } finally {
      sinon.assert.notCalled(formatPdf);
      sinon.assert.notCalled(getPdfContent);
      sinon.assert.notCalled(generatePdf);
      SinonMongoose.calledWithExactly(
        creditNoteFindOne,
        [
          { query: 'find', args: [{ _id: params._id }] },
          {
            query: 'populate',
            args: [{
              path: 'customer',
              select: '_id identity contact subscriptions',
              populate: { path: 'subscriptions.service' },
            }],
          },
          { query: 'populate', args: [{ path: 'thirdPartyPayer', select: '_id name address' }] },
          { query: 'populate', args: [{ path: 'events.auxiliary', select: 'identity' }] },
          { query: 'lean' },
        ]
      );
    }
  });
});
