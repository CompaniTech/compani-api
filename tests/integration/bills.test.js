const expect = require('expect');
const moment = require('moment');
const qs = require('qs');
const omit = require('lodash/omit');
const sinon = require('sinon');
const { ObjectID } = require('mongodb');
const app = require('../../server');
const {
  populateDB,
  billUserList,
  billsList,
  authBillsList,
  billCustomerList,
  billServices,
  eventList,
  billThirdPartyPayer,
  otherCompanyBillThirdPartyPayer,
  customerFromOtherCompany,
  fundingHistory,
} = require('./seed/billsSeed');
const { TWO_WEEKS } = require('../../src/helpers/constants');
const BillHelper = require('../../src/helpers/bills');
const { getToken, getTokenByCredentials, authCompany } = require('./seed/authenticationSeed');
const Bill = require('../../src/models/Bill');
const BillNumber = require('../../src/models/BillNumber');
const CreditNote = require('../../src/models/CreditNote');
const FundingHistory = require('../../src/models/FundingHistory');
const Event = require('../../src/models/Event');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('BILL ROUTES - GET /bills/drafts', () => {
  let authToken = null;
  beforeEach(populateDB);
  const query = {
    endDate: moment.utc().endOf('month').toDate(),
    billingStartDate: moment.utc().startOf('month').toDate(),
    billingPeriod: TWO_WEEKS,
  };

  describe('Admin', () => {
    beforeEach(async () => {
      authToken = await getToken('admin');
    });

    it('should return all draft bills', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/bills/drafts?${qs.stringify(query)}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.draftBills).toEqual(expect.arrayContaining([
        expect.objectContaining({
          customer: expect.objectContaining({
            _id: billCustomerList[0]._id,
            identity: billCustomerList[0].identity,
          }),
          customerBills: expect.objectContaining({
            bills: expect.any(Array),
            total: expect.any(Number),
          }),
        }),
      ]));
    });

    it('should not return all draft bills if customer is not from the same company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/bills/drafts?${qs.stringify(query)}&customer=${customerFromOtherCompany._id}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    const falsyAssertions = [
      { param: 'endDate', query: { ...omit(query, ['endDate']) } },
      { param: 'billingStartDate', query: { ...omit(query, ['billingStartDate']) } },
      { param: 'billingPeriod', query: { ...omit(query, ['billingPeriod']) } },
    ];
    falsyAssertions.forEach((test) => {
      it(`should return a 400 error if '${test.param}' query is missing`, async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/bills/drafts?${qs.stringify(test.query)}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/bills/drafts?${qs.stringify(query)}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('BILL ROUTES - POST /bills', () => {
  let authToken = null;
  beforeEach(populateDB);
  const payload = [
    {
      customer: { _id: billCustomerList[0]._id, identity: billCustomerList[0].identity },
      endDate: '2019-05-30T23:59:59.999Z',
      customerBills: {
        bills: [
          {
            _id: '5ccbfcf4bffe7646a387b470',
            subscription: {
              _id: billCustomerList[0].subscriptions[0]._id,
              service: billServices[0],
              versions: [
                {
                  _id: '5ccbfcf4bffe7646a387b456',
                  unitTTCRate: 12,
                  estimatedWeeklyVolume: 12,
                  evenings: 2,
                  sundays: 1,
                  startDate: '2019-04-03T08:33:55.370Z',
                  createdAt: '2019-05-03T08:33:56.144Z',
                },
              ],
              createdAt: '2019-05-03T08:33:56.144Z',
            },
            discount: 0,
            startDate: '2019-05-01T00:00:00.000Z',
            endDate: '2019-05-31T23:59:59.999Z',
            unitExclTaxes: 10.714285714285714,
            unitInclTaxes: 12,
            vat: 12,
            eventsList: [
              {
                event: eventList[4]._id,
                auxiliary: new ObjectID(),
                startDate: '2019-05-02T08:00:00.000Z',
                endDate: '2019-05-02T10:00:00.000Z',
                inclTaxesCustomer: 24,
                exclTaxesCustomer: 21.428571428571427,
                surcharges: [{ percentage: 90, name: 'Noël' }],
              },
            ],
            hours: 2,
            exclTaxes: 21.428571428571427,
            inclTaxes: 24,
          },
        ],
        total: 24,
      },
      thirdPartyPayerBills: [
        {
          bills: [
            {
              _id: '5ccbfcf4bffe7646a387b472',
              subscription: {
                _id: billCustomerList[0].subscriptions[0]._id,
                service: billServices[0],
                versions: [
                  {
                    _id: '5ccbfcf4bffe7646a387b456',
                    unitTTCRate: 12,
                    estimatedWeeklyVolume: 12,
                    evenings: 2,
                    sundays: 1,
                    startDate: '2019-04-03T08:33:55.370Z',
                    createdAt: '2019-05-03T08:33:56.144Z',
                  },
                ],
                createdAt: '2019-05-03T08:33:56.144Z',
              },
              discount: 0,
              startDate: '2019-05-01T00:00:00.000Z',
              endDate: '2019-05-31T23:59:59.999Z',
              unitExclTaxes: 10.714285714285714,
              unitInclTaxes: 12,
              vat: 12,
              exclTaxes: 21.428571428571427,
              inclTaxes: 24,
              hours: 2,
              eventsList: [
                {
                  event: eventList[4]._id,
                  auxiliary: new ObjectID(),
                  startDate: '2019-05-02T08:00:00.000Z',
                  endDate: '2019-05-02T10:00:00.000Z',
                  inclTaxesTpp: 24,
                  exclTaxesTpp: 21.428571428571427,
                  thirdPartyPayer: billThirdPartyPayer._id,
                  inclTaxesCustomer: 0,
                  exclTaxesCustomer: 0,
                  history: { amountTTC: 24, fundingId: fundingHistory.fundingId, nature: 'fixed' },
                  fundingId: fundingHistory.fundingId,
                  nature: 'fixed',
                },
              ],
              externalBilling: false,
              thirdPartyPayer: billThirdPartyPayer,
            },
          ],
          total: 24,
        },
      ],
    },
  ];
  const payloadWithTwoSubscriptions = [
    {
      customer: { _id: billCustomerList[0]._id, identity: billCustomerList[0].identity },
      endDate: '2019-05-30T23:59:59.999Z',
      customerBills: {
        bills: [
          {
            _id: '5ccbfcf4bffe7646a387b470',
            subscription: {
              _id: billCustomerList[0].subscriptions[1]._id,
              service: billServices[1],
              versions: [
                {
                  _id: '5ccbfcf4bffe7646a387b456',
                  unitTTCRate: 12,
                  estimatedWeeklyVolume: 12,
                  evenings: 2,
                  sundays: 1,
                  startDate: '2019-04-03T08:33:55.370Z',
                  createdAt: '2019-05-03T08:33:56.144Z',
                },
              ],
              createdAt: '2019-05-03T08:33:56.144Z',
            },
            discount: 0,
            startDate: '2019-05-01T00:00:00.000Z',
            endDate: '2019-05-31T23:59:59.999Z',
            unitExclTaxes: 10.714285714285714,
            unitInclTaxes: 12,
            vat: 12,
            eventsList: [
              {
                event: eventList[4]._id,
                auxiliary: new ObjectID(),
                startDate: '2019-05-02T08:00:00.000Z',
                endDate: '2019-05-02T10:00:00.000Z',
                inclTaxesCustomer: 24,
                exclTaxesCustomer: 21.428571428571427,
                surcharges: [{ percentage: 90, name: 'Noël' }],
              },
            ],
            hours: 2,
            exclTaxes: 21.428571428571427,
            inclTaxes: 24,
          },
          {
            _id: '5ccbfcf4bffe7646a387b470',
            subscription: {
              _id: billCustomerList[0].subscriptions[0]._id,
              service: billServices[0],
              versions: [
                {
                  _id: '5ccbfcf4bffe7646a387b456',
                  unitTTCRate: 12,
                  estimatedWeeklyVolume: 12,
                  evenings: 2,
                  sundays: 1,
                  startDate: '2019-04-03T08:33:55.370Z',
                  createdAt: '2019-05-03T08:33:56.144Z',
                },
              ],
              createdAt: '2019-05-03T08:33:56.144Z',
            },
            discount: 0,
            startDate: '2019-05-01T00:00:00.000Z',
            endDate: '2019-05-31T23:59:59.999Z',
            unitExclTaxes: 10.714285714285714,
            unitInclTaxes: 12,
            vat: 12,
            eventsList: [
              {
                event: eventList[4]._id,
                auxiliary: new ObjectID(),
                startDate: '2019-05-02T08:00:00.000Z',
                endDate: '2019-05-02T10:00:00.000Z',
                inclTaxesCustomer: 24,
                exclTaxesCustomer: 21.428571428571427,
                surcharges: [{ percentage: 90, name: 'Noël' }],
              },
            ],
            hours: 2,
            exclTaxes: 21.428571428571427,
            inclTaxes: 24,
          },
        ],
        total: 24,
      },
    },
  ];

  describe('Admin', () => {
    beforeEach(async () => {
      authToken = await getToken('admin');
    });

    it('should create new bills', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: { bills: payload },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const bills = await Bill.find({ company: authCompany._id }).lean();
      expect(bills.length).toBe(2 + authBillsList.length);
      const linkedCreditNote = await CreditNote.find({ customer: billCustomerList[0]._id, company: authCompany._id });
      expect(linkedCreditNote.isEditable).toBeFalsy();
    });

    it('should create new bills (2 subscriptions)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: { bills: payloadWithTwoSubscriptions },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const bills = await Bill.find({ company: authCompany._id }).lean();
      expect(bills.length).toBe(1 + authBillsList.length);
    });

    it('should not create new bill with existing number', async () => {
      const formatBillNumber = sinon.stub(BillHelper, 'formatBillNumber');
      formatBillNumber.returns(billsList[0].number);

      const billCountBefore = await Bill.countDocuments({});
      const billNumberBefore = await BillNumber.findOne({ prefix: '0519' }).lean();
      const fundingHistoryBefore = await FundingHistory.findOne({ fundingId: fundingHistory.fundingId }).lean();

      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: { bills: payload },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toEqual(500);
      formatBillNumber.restore();

      const billCountAfter = await Bill.countDocuments({});
      expect(billCountAfter).toEqual(billCountBefore);
      const billNumberAfter = await BillNumber.findOne({ prefix: '0519' }).lean();
      expect(billNumberBefore.seq).toEqual(billNumberAfter.seq);
      const fundingHistoryAfter = await FundingHistory.findOne({ fundingId: fundingHistory.fundingId }).lean();
      expect(fundingHistoryBefore.amountTTC).toEqual(fundingHistoryAfter.amountTTC);
      const eventInBill = await Event.findOne({ _id: eventList[4]._id }).lean();
      expect(eventInBill.isBilled).toBeFalsy();
      expect(eventInBill.bills).toEqual({ surcharges: [] });
    });

    it('should create new bill with vat 0 if service is not taxed', async () => {
      const draftBillPayload = [
        {
          customer: {
            _id: billCustomerList[0]._id,
            identity: billCustomerList[0].identity,
          },
          endDate: '2019-05-31T23:59:59.999Z',
          customerBills: {
            bills: [
              {
                _id: '5ccbfcf4bffe7646a387b470',
                subscription: {
                  _id: billCustomerList[0].subscriptions[0]._id,
                  service: {
                    ...billServices[0],
                    versions: [{
                      defaultUnitAmount: 12,
                      name: 'Service 1',
                      startDate: '2019-01-16 17:58:15.519',
                      vat: 0,
                    }],
                  },
                  versions: [
                    {
                      _id: '5ccbfcf4bffe7646a387b456',
                      unitTTCRate: 12,
                      estimatedWeeklyVolume: 12,
                      evenings: 2,
                      sundays: 1,
                      startDate: '2019-04-03T08:33:55.370Z',
                      createdAt: '2019-05-03T08:33:56.144Z',
                    },
                  ],
                  createdAt: '2019-05-03T08:33:56.144Z',
                },
                discount: 0,
                startDate: '2019-05-01T00:00:00.000Z',
                endDate: '2019-05-31T23:59:59.999Z',
                unitExclTaxes: 10.714285714285714,
                unitInclTaxes: 12,
                vat: 0,
                eventsList: [
                  {
                    event: eventList[4]._id,
                    auxiliary: new ObjectID(),
                    startDate: '2019-05-02T08:00:00.000Z',
                    endDate: '2019-05-02T10:00:00.000Z',
                    inclTaxesCustomer: 24,
                    exclTaxesCustomer: 24,
                    surcharges: [{ percentage: 90, name: 'Noël' }],
                  },
                ],
                hours: 2,
                exclTaxes: 24,
                inclTaxes: 24,
              },
            ],
            total: 24,
          },
        },
      ];
      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: { bills: draftBillPayload },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const bills = await Bill.find({ 'subscriptions.vat': 0, company: authCompany._id }).lean();
      expect(bills.length).toBe(1);
    });

    it('should create a new external bill', async () => {
      const draftBillPayload = [
        {
          customer: {
            _id: billCustomerList[0]._id,
            identity: billCustomerList[0].identity,
          },
          endDate: '2019-05-31T23:59:59.999Z',
          customerBills: { bills: [], total: 0 },
          thirdPartyPayerBills: [
            {
              bills: [
                {
                  _id: '5ccbfcf4bffe7646a387b472',
                  subscription: {
                    _id: billCustomerList[0].subscriptions[0]._id,
                    service: billServices[0],
                    versions: [
                      {
                        _id: '5ccbfcf4bffe7646a387b456',
                        unitTTCRate: 12,
                        estimatedWeeklyVolume: 12,
                        evenings: 2,
                        sundays: 1,
                        startDate: '2019-04-03T08:33:55.370Z',
                        createdAt: '2019-05-03T08:33:56.144Z',
                      },
                    ],
                    createdAt: '2019-05-03T08:33:56.144Z',
                  },
                  discount: 0,
                  startDate: '2019-05-01T00:00:00.000Z',
                  endDate: '2019-05-31T23:59:59.999Z',
                  unitExclTaxes: 10.714285714285714,
                  unitInclTaxes: 12,
                  vat: 12,
                  exclTaxes: 21.428571428571427,
                  inclTaxes: 24,
                  hours: 2,
                  eventsList: [
                    {
                      event: eventList[4]._id,
                      auxiliary: new ObjectID(),
                      startDate: '2019-05-02T08:00:00.000Z',
                      endDate: '2019-05-02T10:00:00.000Z',
                      inclTaxesTpp: 24,
                      exclTaxesTpp: 21.428571428571427,
                      thirdPartyPayer: billThirdPartyPayer._id,
                      inclTaxesCustomer: 0,
                      exclTaxesCustomer: 0,
                      history: {
                        amountTTC: 24,
                        fundingId: '5ccbfcf4bffe7646a387b45a',
                        nature: 'fixed',
                      },
                      fundingId: '5ccbfcf4bffe7646a387b45a',
                      nature: 'fixed',
                    },
                  ],
                  externalBilling: true,
                  thirdPartyPayer: billThirdPartyPayer,
                },
              ],
              total: 24,
            },
          ],
        },
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: { bills: draftBillPayload },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      const bills = await Bill.find({ company: authCompany._id }).lean();
      expect(bills.some(bill => !bill.number)).toBeTruthy();
      const draftBillsLength = draftBillPayload[0].thirdPartyPayerBills[0].bills.length;
      expect(bills.length).toBe(draftBillsLength + authBillsList.length);
    });

    it('should return a 403 error if customer is not from same company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: { bills: [{ ...payload[0], customer: { ...payload[0].customer, _id: billCustomerList[2]._id } }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 error if third party payer is not from same company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: {
          bills: [{
            ...payload[0],
            thirdPartyPayerBills: [{
              ...payload[0].thirdPartyPayerBills[0],
              bills: [{
                ...payload[0].thirdPartyPayerBills[0].bills[0],
                thirdPartyPayer: otherCompanyBillThirdPartyPayer,
              }],
            }],
          }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 error if at least one event is not from same company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: {
          bills: [{
            ...payload[0],
            customerBills: {
              ...payload[0].customerBills,
              bills: [{
                ...payload[0].customerBills.bills[0],
                eventsList: [{
                  event: eventList[5]._id,
                  auxiliary: new ObjectID(),
                  startDate: '2019-05-02T08:00:00.000Z',
                  endDate: '2019-05-02T10:00:00.000Z',
                  inclTaxesCustomer: 24,
                  exclTaxesCustomer: 24,
                  surcharges: [{ percentage: 90, name: 'Noël' }],
                }],
              }],
            },
          }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 403 error if at least one bill subscription is not from same company', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/bills',
        payload: {
          bills: [{
            ...payload[0],
            customerBills: {
              ...payload[0].customerBills,
              bills: [{
                ...payload[0].customerBills.bills[0],
                subscription: {
                  _id: billCustomerList[2].subscriptions[0]._id,
                  service: billServices[1],
                  versions: [
                    {
                      _id: '5ccbfcf4bffe7646a387b456',
                      unitTTCRate: 12,
                      estimatedWeeklyVolume: 12,
                      evenings: 2,
                      sundays: 1,
                      startDate: '2019-04-03T08:33:55.370Z',
                      createdAt: '2019-05-03T08:33:56.144Z',
                    },
                  ],
                  createdAt: '2019-05-03T08:33:56.144Z',
                },
              }],
            },
          }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/bills',
          payload: { bills: payload },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('BILL ROUTES - GET /bills/pdfs', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('Admin', () => {
    beforeEach(async () => {
      authToken = await getToken('admin');
    });

    it('should get bill pdf', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/bills/${authBillsList[0]._id}/pdfs`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 403 error if bill customer is not from same company', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/bills/${billsList[0]._id}/pdfs`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Other roles', () => {
    it('should return customer bills pdf if I am its helper', async () => {
      const helper = billUserList[0];
      const helperToken = await getTokenByCredentials(helper.local);
      const res = await app.inject({
        method: 'GET',
        url: `/bills/${authBillsList[0]._id}/pdfs`,
        headers: { 'x-access-token': helperToken },
      });
      expect(res.statusCode).toBe(200);
    });

    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'coach', expectedCode: 200 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: `/bills/${authBillsList[0]._id}/pdfs`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
