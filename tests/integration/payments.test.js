const expect = require('expect');
const moment = require('moment');
const sinon = require('sinon');
const { ObjectID } = require('mongodb');

const app = require('../../server');
const { getToken } = require('./seed/usersSeed');
const { customersList, populateCustomers } = require('./seed/customersSeed');
const { thirdPartyPayersList, populateThirdPartyPayers } = require('./seed/thirdPartyPayersSeed');
const { paymentsList, populatePayments } = require('./seed/paymentsSeed');
const { populateCompanies } = require('./seed/companiesSeed');
const { populateUsers } = require('./seed/usersSeed');
const { PAYMENT, REFUND, PAYMENT_TYPES } = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const Payment = require('../../models/Payment');
const Drive = require('../../models/Google/Drive');

const { language } = translate;

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('PAYMENTS ROUTES', () => {
  let token = null;
  before(populateCompanies);
  before(populateUsers);
  before(populateCustomers);
  before(populateThirdPartyPayers);
  beforeEach(populatePayments);
  beforeEach(async () => {
    token = await getToken();
  });

  describe('GET /payments', () => {
    it('should get all payments', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/payments',
        headers: { 'x-access-token': token }
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data.payments.length).toBe(paymentsList.length);
    });
  });

  describe('POST /payments', () => {
    const origPayload = {
      date: moment().toDate(),
      customer: customersList[0]._id,
      client: thirdPartyPayersList[0]._id,
      netInclTaxes: 400,
      nature: PAYMENT,
      type: PAYMENT_TYPES[0]
    };
    const creationAssertions = [{ ...origPayload }, { ...origPayload, nature: REFUND }];

    creationAssertions.forEach((payload) => {
      it(`should create a ${payload.nature}`, async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/payments',
          payload,
          headers: { 'x-access-token': token }
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.message).toBe(translate[language].paymentCreated);
        expect(res.result.data.payment).toEqual(expect.objectContaining(payload));
        expect(res.result.data.payment.number).toBe(payload.nature === PAYMENT ? `REG-${moment().format('YYMM')}001` : `REMB-${moment().format('YYMM')}001`);
        const payments = await Payment.find().lean();
        expect(payments.length).toBe(paymentsList.length + 1);
      });
    });

    const falsyAssertions = [
      {
        param: 'date',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'customer',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'netInclTaxes',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'nature',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'type',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      }
    ];

    falsyAssertions.forEach((test) => {
      it(`should return a 400 error if '${test.param}' param is missing`, async () => {
        test.update();
        const res = await app.inject({
          method: 'POST',
          url: '/payments',
          payload: test.payload,
          headers: { 'x-access-token': token }
        });
        expect(res.statusCode).toBe(400);
      });
    });
    it('should create multiple payments', async () => {
      const payload = [
        {
          date: moment().toDate(),
          customer: customersList[0]._id,
          customerInfo: customersList[0],
          netInclTaxes: 900,
          nature: PAYMENT,
          type: PAYMENT_TYPES[0]
        },
        {
          date: moment().toDate(),
          customer: customersList[1]._id,
          customerInfo: customersList[1],
          netInclTaxes: 250,
          nature: PAYMENT,
          type: PAYMENT_TYPES[0]
        },
      ];

      const mock = sinon.stub(Drive, 'add');

      const res = await app.inject({
        method: 'POST',
        url: '/payments',
        payload,
        headers: { 'x-access-token': token }
      });

      expect(res.statusCode).toBe(200);
      const payments = await Payment.find().lean();
      expect(payments.length).toBe(paymentsList.length + 2);
      mock.restore();
    });
  });

  describe('PUT /payments/_id', () => {
    const origPayload = {
      netInclTaxes: 200,
      date: '2019-04-16T22:00:00.000',
      type: 'withdrawal',
    };

    it('should update payment', async () => {
      const payload = { ...origPayload };
      const res = await app.inject({
        method: 'PUT',
        url: `/payments/${paymentsList[0]._id}`,
        headers: { 'x-access-token': token },
        payload,
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data.payment.netInclTaxes).toEqual(payload.netInclTaxes);
      expect(res.result.data.payment.date).toBeDefined();
      expect(moment(res.result.data.payment.date).toISOString()).toEqual(moment(payload.date).toISOString());
      expect(res.result.data.payment.type).toEqual(payload.type);
    });

    it('should return 404 as payment is not found', async () => {
      const invalidId = new ObjectID();
      const payload = {
        netInclTaxes: 200,
        date: '2019-04-16T22:00:00.000',
        type: 'withdrawal',
      };
      const res = await app.inject({
        method: 'PUT',
        url: `/payments/${invalidId}`,
        headers: { 'x-access-token': token },
        payload,
      });
      expect(res.statusCode).toBe(404);
    });

    const falsyAssertions = [
      {
        param: 'date',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'netInclTaxes',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'type',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      }
    ];

    falsyAssertions.forEach((test) => {
      it(`should return a 400 error if '${test.param}' param is missing`, async () => {
        test.update();
        const res = await app.inject({
          method: 'PUT',
          url: `/payments/${paymentsList[0]._id}`,
          headers: { 'x-access-token': token },
          payload: test.payload,
        });
        expect(res.statusCode).toBe(400);
      });
    });
  });
});
