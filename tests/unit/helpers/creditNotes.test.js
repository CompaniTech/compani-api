const { ObjectID } = require('mongodb');
const Boom = require('boom');
const expect = require('expect');
const sinon = require('sinon');
const FundingHistory = require('../../../src/models/FundingHistory');
const CreditNoteNumber = require('../../../src/models/CreditNoteNumber');
const CreditNote = require('../../../src/models/CreditNote');
const Company = require('../../../src/models/Company');
const Event = require('../../../src/models/Event');
const CreditNoteHelper = require('../../../src/helpers/creditNotes');
const UtilsHelper = require('../../../src/helpers/utils');
const translate = require('../../../src/helpers/translate');
const PdfHelper = require('../../../src/helpers/pdf');
const SubscriptionHelper = require('../../../src/helpers/subscriptions');
const { COMPANI, OGUST } = require('../../../src/helpers/constants');
const moment = require('moment');

const { language } = translate;

require('sinon-mongoose');

describe('getCreditNotes', () => {
  let getDateQueryStub;
  let CreditNoteMock;
  let populateSubscriptionsServicesStub;
  const companyId = new ObjectID();
  const credentials = { company: { _id: companyId } };
  const customerId = new ObjectID();

  beforeEach(() => {
    getDateQueryStub = sinon.stub(UtilsHelper, 'getDateQuery');
    populateSubscriptionsServicesStub = sinon.stub(SubscriptionHelper, 'populateSubscriptionsServices');
    CreditNoteMock = sinon.mock(CreditNote);
  });
  afterEach(() => {
    getDateQueryStub.restore();
    CreditNoteMock.restore();
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
    const query = { date: dateQuery, customer: customerId, company: companyId };
    CreditNoteMock.expects('find')
      .withExactArgs(query)
      .chain('populate')
      .withExactArgs({
        path: 'customer',
        select: '_id identity subscriptions',
        populate: { path: 'subscriptions.service' },
      })
      .chain('populate')
      .withExactArgs({ path: 'thirdPartyPayer', select: '_id name' })
      .chain('lean')
      .returns([{ customer: { _id: customerId } }]);
    populateSubscriptionsServicesStub.returns({ _id: customerId, firstname: 'toto' });

    const result = await CreditNoteHelper.getCreditNotes(payload, credentials);
    expect(result).toEqual([{ customer: { _id: customerId, firstname: 'toto' } }]);
    sinon.assert.calledWithExactly(getDateQueryStub, { startDate: payload.startDate, endDate: payload.endDate });
    sinon.assert.calledWithExactly(populateSubscriptionsServicesStub, { _id: customerId });
  });

  it('should not call getDateQuery if no date in payload', async () => {
    const payload = {
      customer: customerId,
    };
    const query = { customer: customerId, company: companyId };
    CreditNoteMock.expects('find')
      .withExactArgs(query)
      .chain('populate')
      .withExactArgs({
        path: 'customer',
        select: '_id identity subscriptions',
        populate: { path: 'subscriptions.service' },
      })
      .chain('populate')
      .withExactArgs({ path: 'thirdPartyPayer', select: '_id name' })
      .chain('lean')
      .returns([{ customer: { _id: customerId } }]);
    populateSubscriptionsServicesStub.returns({ _id: customerId, firstname: 'toto' });

    const result = await CreditNoteHelper.getCreditNotes(payload, credentials);
    expect(result).toEqual([{ customer: { _id: customerId, firstname: 'toto' } }]);
    sinon.assert.notCalled(getDateQueryStub);
    sinon.assert.calledWithExactly(populateSubscriptionsServicesStub, { _id: customerId });
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
    const query = { date: dateQuery, customer: customerId, company: companyId };
    CreditNoteMock.expects('find')
      .withExactArgs(query)
      .chain('populate')
      .withExactArgs({
        path: 'customer',
        select: '_id identity subscriptions',
        populate: { path: 'subscriptions.service' },
      })
      .chain('populate')
      .withExactArgs({ path: 'thirdPartyPayer', select: '_id name' })
      .chain('lean')
      .returns([]);

    const result = await CreditNoteHelper.getCreditNotes(payload, credentials);
    expect(result).toEqual([]);
    sinon.assert.calledWithExactly(getDateQueryStub, { startDate: payload.startDate, endDate: payload.endDate });
    sinon.assert.notCalled(populateSubscriptionsServicesStub);
  });
});

describe('updateEventAndFundingHistory', () => {
  let findOneAndUpdate;
  let updateOne;
  let find;
  let save;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(FundingHistory, 'findOneAndUpdate');
    updateOne = sinon.stub(FundingHistory, 'updateOne');
    find = sinon.stub(Event, 'find');
    save = sinon.stub(Event.prototype, 'save');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
    updateOne.restore();
    find.restore();
    save.restore();
  });

  it('should increment history for hourly and once funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        company: new ObjectID(),
        bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    findOneAndUpdate.returns(null);
    const credentials = { company: { _id: new ObjectID() } };

    await CreditNoteHelper.updateEventAndFundingHistory([], false, credentials);
    sinon.assert.calledWithExactly(
      findOneAndUpdate,
      { fundingId, month: '01/2019' },
      { $inc: { careHours: -3 } }
    );
    sinon.assert.calledWithExactly(
      updateOne,
      { fundingId },
      { $inc: { careHours: -3 } }
    );
  });

  it('should increment history for hourly and monthly funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        company: new ObjectID(),
        bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    findOneAndUpdate.returns(new FundingHistory());
    const credentials = { company: { _id: new ObjectID() } };

    await CreditNoteHelper.updateEventAndFundingHistory([], false, credentials);
    sinon.assert.calledWithExactly(
      findOneAndUpdate,
      { fundingId, month: '01/2019' },
      { $inc: { careHours: -3 } }
    );
    sinon.assert.notCalled(updateOne);
  });

  it('should decrement history for hourly and monthly funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        company: new ObjectID(),
        bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    findOneAndUpdate.returns(null);
    const credentials = { company: { _id: new ObjectID() } };

    await CreditNoteHelper.updateEventAndFundingHistory([], true, credentials);
    sinon.assert.calledWithExactly(
      findOneAndUpdate,
      { fundingId, month: '01/2019' },
      { $inc: { careHours: 3 } }
    );
    sinon.assert.calledWithExactly(
      updateOne,
      { fundingId },
      { $inc: { careHours: 3 } }
    );
  });

  it('should increment history for fixed and once funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        company: new ObjectID(),
        bills: { nature: 'fixed', fundingId, thirdPartyPayer: new ObjectID(), inclTaxesTpp: 666 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    const credentials = { company: { _id: new ObjectID() } };

    await CreditNoteHelper.updateEventAndFundingHistory([], false, credentials);
    sinon.assert.calledWithExactly(
      updateOne,
      { fundingId },
      { $inc: { amountTTC: -666 } }
    );
  });
});

describe('formatPDF', () => {
  let getMatchingVersion;
  let formatPrice;
  let formatEventSurchargesForPdf;
  beforeEach(() => {
    getMatchingVersion = sinon.stub(UtilsHelper, 'getMatchingVersion').returns({ name: 'Toto' });
    formatPrice = sinon.stub(UtilsHelper, 'formatPrice');
    formatEventSurchargesForPdf = sinon.stub(PdfHelper, 'formatEventSurchargesForPdf');
  });

  afterEach(() => {
    getMatchingVersion.restore();
    formatPrice.restore();
    formatEventSurchargesForPdf.restore();
  });

  it('should format correct credit note PDF with events for customer', () => {
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
        exclTaxes: '221,00 €',
        inclTaxes: '234,00 €',
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
        recipient: {
          name: 'M. Toto Bobo',
          address: { fullAddress: 'La ruche' },
        },
        company: {},
        logo:
          'https://res.cloudinary.com/alenvi/image/upload/v1507019444/images/business/alenvi_logo_complet_183x50.png',
      },
    };

    formatPrice.onCall(0).returns('13,00 €');
    formatPrice.onCall(1).returns('221,00 €');
    formatPrice.onCall(2).returns('234,00 €');
    formatEventSurchargesForPdf.returns([{ percentage: 30, startHour: '19h' }]);

    const result = CreditNoteHelper.formatPDF(creditNote, {});

    expect(result).toEqual(expectedResult);
    sinon.assert.calledWith(formatEventSurchargesForPdf, [{ percentage: 30 }]);
  });

  it('should format correct credit note PDF with events for tpp', () => {
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

    const expectedResult = {
      creditNote: {
        number: 1,
        customer: {
          identity: { firstname: 'Toto', lastname: 'Bobo', title: 'Mme' },
          contact: { primaryAddress: { fullAddress: 'La ruche' } },
        },
        forTpp: true,
        date: moment('2019-04-29T22:00:00.000Z').format('DD/MM/YYYY'),
        exclTaxes: '21,00 €',
        inclTaxes: '34,00 €',
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
        recipient: {
          name: 'tpp',
          address: { fullAddress: "j'habite ici" },
        },
        company: {},
        logo:
          'https://res.cloudinary.com/alenvi/image/upload/v1507019444/images/business/alenvi_logo_complet_183x50.png',
      },
    };

    formatPrice.onCall(0).returns('13,00 €');
    formatPrice.onCall(1).returns('21,00 €');
    formatPrice.onCall(2).returns('34,00 €');

    const result = CreditNoteHelper.formatPDF(creditNote, {});

    expect(result).toBeDefined();
    expect(result).toEqual(expectedResult);
    sinon.assert.notCalled(formatEventSurchargesForPdf);
  });

  it('should format correct credit note PDF with subscription', () => {
    const creditNote = {
      number: 1,
      subscription: {
        service: {
          name: 'service',
        },
        unitInclTaxes: 12,
      },
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

    formatPrice.onCall(0).returns('12,00 €');

    const result = CreditNoteHelper.formatPDF(creditNote, {});

    expect(result).toBeDefined();
    expect(result.creditNote.subscription).toBeDefined();
    expect(result.creditNote.subscription.service).toBe('service');
    expect(result.creditNote.subscription.unitInclTaxes).toBe('12,00 €');
  });
});

describe('createCreditNotes', () => {
  let findOneAndUpdateNumber;
  let formatCreditNote;
  let insertManyCreditNote;
  let updateEventAndFundingHistory;
  const credentials = { company: { _id: new ObjectID() } };
  const prefix = 'AV-1907';

  beforeEach(() => {
    findOneAndUpdateNumber = sinon.stub(CreditNoteNumber, 'findOneAndUpdate');
    formatCreditNote = sinon.stub(CreditNoteHelper, 'formatCreditNote');
    insertManyCreditNote = sinon.stub(CreditNote, 'insertMany');
    updateEventAndFundingHistory = sinon.stub(CreditNoteHelper, 'updateEventAndFundingHistory');
  });
  afterEach(() => {
    findOneAndUpdateNumber.restore();
    formatCreditNote.restore();
    insertManyCreditNote.restore();
    updateEventAndFundingHistory.restore();
  });

  it('should create one credit note (for customer)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesCustomer: 123,
      thirdPartyPayer: 'qwertyuiop',
    };
    findOneAndUpdateNumber.onCall(0).returns({ seq: 1, prefix });
    formatCreditNote.returns({ inclTaxesCustomer: 1234 });

    await CreditNoteHelper.createCreditNotes(payload, credentials);

    sinon.assert.calledWithExactly(
      formatCreditNote,
      {
        date: '2019-07-30T00:00:00',
        inclTaxesCustomer: 123,
        exclTaxesTpp: 0,
        inclTaxesTpp: 0,
        company: credentials.company._id,
      },
      prefix,
      1
    );
    sinon.assert.calledWithExactly(insertManyCreditNote, [{ inclTaxesCustomer: 1234 }]);
    sinon.assert.notCalled(updateEventAndFundingHistory);
    sinon.assert.calledWithExactly(
      findOneAndUpdateNumber.getCall(0),
      { prefix },
      {},
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    sinon.assert.calledWithExactly(
      findOneAndUpdateNumber.getCall(1),
      { prefix },
      { $set: { seq: 2 } }
    );
  });

  it('should create one credit note (for tpp)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesTpp: 123,
      thirdPartyPayer: 'qwertyuiop',
      events: [{ _id: 'asdfghjkl' }],
    };
    findOneAndUpdateNumber.onCall(0).returns({ seq: 1, prefix });
    formatCreditNote.returns({ inclTaxesTpp: 1234 });

    await CreditNoteHelper.createCreditNotes(payload, credentials);

    sinon.assert.calledWithExactly(
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
      prefix,
      1
    );
    sinon.assert.calledWithExactly(insertManyCreditNote, [{ inclTaxesTpp: 1234 }]);
    sinon.assert.calledWithExactly(updateEventAndFundingHistory, [{ _id: 'asdfghjkl' }], false, credentials);
    sinon.assert.calledWithExactly(
      findOneAndUpdateNumber.getCall(0),
      { prefix },
      {},
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    sinon.assert.calledWithExactly(
      findOneAndUpdateNumber.getCall(1),
      { prefix },
      { $set: { seq: 2 } }
    );
  });

  it('should create two credit notes (for customer and tpp)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesTpp: 123,
      inclTaxesCustomer: 654,
      thirdPartyPayer: 'qwertyuiop',
    };
    findOneAndUpdateNumber.onCall(0).returns({ seq: 1, prefix });
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
      prefix,
      2
    );
    sinon.assert.calledWithExactly(
      insertManyCreditNote,
      [
        { _id: '0987', linkedCreditNote: '1234', inclTaxesTpp: 1234 },
        { _id: '1234', linkedCreditNote: '0987', inclTaxesCustomer: 32 },
      ]
    );
    sinon.assert.notCalled(updateEventAndFundingHistory);
    sinon.assert.calledWithExactly(
      findOneAndUpdateNumber.getCall(0),
      { prefix },
      {},
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    sinon.assert.calledWithExactly(
      findOneAndUpdateNumber.getCall(1),
      { prefix },
      { $set: { seq: 3 } }
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
    const payload = { customer: { identity: { firstname: 'Titi' } } };
    const updatedCreditNote = {
      ...creditNote,
      customer: {
        ...creditNote.customer,
        identity: {
          ...creditNote.customer.identity,
          firstname: payload.customer.identity.firstname,
        },
      },
    };

    findByIdAndUpdate.returns(updatedCreditNote);

    const result = await CreditNoteHelper.updateCreditNotes(creditNote, payload, credentials);

    expect(result).toMatchObject(updatedCreditNote);
    sinon.assert.calledWithExactly(
      updateEventAndFundingHistory,
      creditNote.events,
      true,
      credentials
    );
    sinon.assert.calledWithExactly(
      findByIdAndUpdate,
      creditNote._id,
      { $set: payload },
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
    sinon.assert.calledWithExactly(
      updateEventAndFundingHistory.secondCall,
      payload.events,
      false,
      credentials
    );
    sinon.assert.calledWithExactly(
      findByIdAndUpdate,
      creditNote._id,
      { $set: { ...payload, inclTaxesTpp: 0, exclTaxesTpp: 0 } },
      { new: true }
    );
    sinon.assert.calledWithExactly(
      updateOne,
      { _id: creditNoteWithLink.linkedCreditNote },
      { $set: { ...payload, inclTaxesCustomer: 0, exclTaxesCustomer: 0 } },
      { new: true }
    );
  });

  it('should update a tpp credit note and its customer linked credit note', async () => {
    const creditNoteWithLink = { ...creditNote, thirdPartyPayer: new ObjectID(), linkedCreditNote: new ObjectID() };
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
    sinon.assert.calledWithExactly(
      updateEventAndFundingHistory.secondCall,
      payload.events,
      false,
      credentials
    );
    sinon.assert.calledWithExactly(
      findByIdAndUpdate,
      creditNote._id,
      { $set: { ...payload, inclTaxesCustomer: 0, exclTaxesCustomer: 0 } },
      { new: true }
    );
    sinon.assert.calledWithExactly(
      updateOne,
      { _id: creditNoteWithLink.linkedCreditNote },
      { $set: { ...payload, inclTaxesTpp: 0, exclTaxesTpp: 0 } },
      { new: true }
    );
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
    sinon.assert.calledWithExactly(updateEventAndFundingHistoryStub, creditNote.events, true, credentials);
    sinon.assert.calledWithExactly(deleteOneStub, { _id: params._id });
  });

  it('should delete the linked creditNote if it has one', async () => {
    creditNote.linkedCreditNote = new ObjectID();
    await CreditNoteHelper.removeCreditNote(creditNote, credentials, params);
    sinon.assert.calledWithExactly(updateEventAndFundingHistoryStub, creditNote.events, true, credentials);
    expect(deleteOneStub.getCall(0).calledWithExactly(deleteOneStub, { _id: params._id }));
    expect(deleteOneStub.getCall(1).calledWithExactly(deleteOneStub, { _id: creditNote.linkedCreditNote }));
  });
});

describe('generateCreditNotePdf', () => {
  let CreditNoteModel;
  let CompanyModel;
  let formatPDFStub;
  let generatePdfStub;

  const params = { _id: new ObjectID() };
  const credentials = { company: { _id: new ObjectID() } };
  beforeEach(() => {
    CreditNoteModel = sinon.mock(CreditNote);
    CompanyModel = sinon.mock(Company);
    formatPDFStub = sinon.stub(CreditNoteHelper, 'formatPDF');
    generatePdfStub = sinon.stub(PdfHelper, 'generatePdf');
  });

  afterEach(() => {
    CreditNoteModel.restore();
    CompanyModel.restore();
    formatPDFStub.restore();
    generatePdfStub.restore();
  });

  it('should generate a pdf', async () => {
    const creditNote = { origin: COMPANI, number: '12345' };
    CreditNoteModel
      .expects('findOne')
      .withExactArgs({ _id: params._id })
      .chain('populate')
      .withExactArgs({
        path: 'customer',
        select: '_id identity contact subscriptions',
        populate: {
          path: 'subscriptions.service',
        },
      })
      .chain('populate')
      .withExactArgs({
        path: 'thirdPartyPayer',
        select: '_id name address',
      })
      .chain('populate')
      .withExactArgs({ path: 'events.auxiliary', select: 'identity' })
      .chain('lean')
      .returns(creditNote);

    const company = { _id: credentials.company._id };
    CompanyModel.expects('findOne')
      .withExactArgs({ _id: credentials.company._id })
      .chain('lean')
      .returns(company);

    const data = { name: 'creditNotePdf' };
    formatPDFStub.returns(data);
    generatePdfStub.returns({ title: 'creditNote' });

    const result = await CreditNoteHelper.generateCreditNotePdf(params, credentials);

    expect(result).toEqual({ pdf: { title: 'creditNote' }, creditNoteNumber: creditNote.number });
    sinon.assert.calledWithExactly(formatPDFStub, creditNote, company);
    sinon.assert.calledWithExactly(generatePdfStub, data, './src/data/creditNote.html');
    CreditNoteModel.verify();
    CompanyModel.verify();
  });

  it('should return a 404 if creditnote is not found', async () => {
    try {
      CreditNoteModel
        .expects('findOne')
        .withExactArgs({ _id: params._id })
        .chain('populate')
        .withExactArgs({
          path: 'customer',
          select: '_id identity contact subscriptions',
          populate: {
            path: 'subscriptions.service',
          },
        })
        .chain('populate')
        .withExactArgs({
          path: 'thirdPartyPayer',
          select: '_id name address',
        })
        .chain('populate')
        .withExactArgs({ path: 'events.auxiliary', select: 'identity' })
        .chain('lean')
        .returns();
      await CreditNoteHelper.generateCreditNotePdf(params, credentials);
    } catch (e) {
      expect(e).toEqual(Boom.notFound(translate[language].creditNoteNotFound));
    } finally {
      sinon.assert.notCalled(formatPDFStub);
      sinon.assert.notCalled(generatePdfStub);
      CreditNoteModel.verify();
      CompanyModel.verify();
    }
  });

  it('should return a 500 if creditnote origin is not compani', async () => {
    try {
      CreditNoteModel
        .expects('findOne')
        .withExactArgs({ _id: params._id })
        .chain('populate')
        .withExactArgs({
          path: 'customer',
          select: '_id identity contact subscriptions',
          populate: {
            path: 'subscriptions.service',
          },
        })
        .chain('populate')
        .withExactArgs({
          path: 'thirdPartyPayer',
          select: '_id name address',
        })
        .chain('populate')
        .withExactArgs({ path: 'events.auxiliary', select: 'identity' })
        .chain('lean')
        .returns({ origin: OGUST });
      await CreditNoteHelper.generateCreditNotePdf(params, credentials);
    } catch (e) {
      expect(e).toEqual(Boom.badRequest(translate[language].creditNoteNotCompani));
    } finally {
      sinon.assert.notCalled(formatPDFStub);
      sinon.assert.notCalled(generatePdfStub);
      CreditNoteModel.verify();
      CompanyModel.verify();
    }
  });
});
