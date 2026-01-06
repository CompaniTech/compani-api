const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const SinonMongoose = require('../sinonMongoose');
const PendingCourseBill = require('../../../src/models/PendingCourseBill');
const CourseBill = require('../../../src/models/CourseBill');
const { START_COURSE, RESEND, VENDOR_ADMIN } = require('../../../src/helpers/constants');
const EmailHelper = require('../../../src/helpers/email');
const { sendingPendingBillsByEmailJob } = require('../../../src/jobs/sendingPendingBillsByEmail');
const UtilsMock = require('../../utilsMock');

describe('method', () => {
  let findPendingCourseBill;
  let findCourseBill;
  let sendBillEmail;
  let deleteOnePendingCourseBill;

  beforeEach(() => {
    findPendingCourseBill = sinon.stub(PendingCourseBill, 'find');
    findCourseBill = sinon.stub(CourseBill, 'find');
    sendBillEmail = sinon.stub(EmailHelper, 'sendBillEmail');
    deleteOnePendingCourseBill = sinon.stub(PendingCourseBill, 'deleteOne');
    UtilsMock.mockCurrentDate('2026-01-04T15:00:00.000Z');
  });

  afterEach(() => {
    findPendingCourseBill.restore();
    findCourseBill.restore();
    sendBillEmail.restore();
    deleteOnePendingCourseBill.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should send pendingBills by email', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const companies = [
      { _id: new ObjectId(), name: 'Une structure' },
      { _id: new ObjectId(), name: 'Une autre structure' },
    ];
    const courseBills = [
      {
        _id: courseBillIds[0],
        companies: [companies[0]],
        number: 'FACT-00001',
        payer: companies[0],
      },
      {
        _id: courseBillIds[0],
        companies: [companies[0]],
        number: 'FACT-00002',
        payer: companies[0],
      },
      {
        _id: courseBillIds[0],
        companies: [companies[1]],
        number: 'FACT-00003',
        payer: companies[1],
      },
    ];

    const pendingCourseBills = [
      {
        _id: new ObjectId(),
        courseBills: [courseBillIds[0], courseBillIds[1]],
        sendingDate: '2026-01-05T23:00:00.000Z',
        recipientEmails: ['test@compani.fr', 'test+bis@compani.fr'],
        content: 'Ceci est un test',
        type: START_COURSE,
      },
      {
        _id: new ObjectId(),
        courseBills: [courseBillIds[2]],
        sendingDate: '2026-01-05T23:00:00.000Z',
        recipientEmails: ['test@compani.fr'],
        content: 'Ceci est un test pour relance',
        type: RESEND,
      },
    ];

    findPendingCourseBill.returns(SinonMongoose.stubChainedQueries(pendingCourseBills, ['setOptions', 'lean']));
    findCourseBill.onCall(0).returns(SinonMongoose.stubChainedQueries([courseBills[0], courseBills[1]]));
    findCourseBill.onCall(1).returns(SinonMongoose.stubChainedQueries([courseBills[2]]));

    // eslint-disable-next-line no-console
    const server = { log: value => console.log(value) };
    const res = await sendingPendingBillsByEmailJob.method(server);
    expect(res).toEqual({ day: '2026-01-03T23:00:00.000Z', emailSent: 2, pendingCourseBillDeleted: 2 });

    SinonMongoose.calledWithExactly(
      findPendingCourseBill,
      [
        { query: 'find', args: [{ sendingDate: '2026-01-03T23:00:00.000Z' }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      findCourseBill,
      [
        { query: 'find', args: [{ _id: { $in: [courseBillIds[0], courseBillIds[1]] } }] },
        {
          query: 'populate',
          args: [
            {
              path: 'payer',
              populate: [{ path: 'company', select: 'name' }, { path: 'fundingOrganisation', select: 'name' }],
            },
          ],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findCourseBill,
      [
        { query: 'find', args: [{ _id: { $in: [courseBillIds[2]] } }] },
        {
          query: 'populate',
          args: [
            {
              path: 'payer',
              populate: [{ path: 'company', select: 'name' }, { path: 'fundingOrganisation', select: 'name' }],
            },
          ],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.calledWithExactly(
      sendBillEmail.getCall(0),
      [courseBills[0], courseBills[1]],
      START_COURSE,
      'Ceci est un test',
      ['test@compani.fr', 'test+bis@compani.fr'],
      '2026-01-05T23:00:00.000Z',
      { role: { vendor: { name: VENDOR_ADMIN } } }
    );
    sinon.assert.calledWithExactly(
      sendBillEmail.getCall(1),
      [courseBills[2]],
      RESEND,
      'Ceci est un test pour relance',
      ['test@compani.fr'],
      '2026-01-05T23:00:00.000Z',
      { role: { vendor: { name: VENDOR_ADMIN } } }
    );
    sinon.assert.calledWithExactly(deleteOnePendingCourseBill.getCall(0), { _id: pendingCourseBills[0]._id });
    sinon.assert.calledWithExactly(deleteOnePendingCourseBill.getCall(1), { _id: pendingCourseBills[1]._id });
  });
});

describe('onComplete', () => {
  let completionSendingPendingBillsEmail;
  let serverLogStub;
  // eslint-disable-next-line no-console
  const server = { log: value => console.log(value) };

  beforeEach(() => {
    completionSendingPendingBillsEmail = sinon.stub(EmailHelper, 'completionSendingPendingBillsEmail');
    serverLogStub = sinon.stub(server, 'log');
  });

  afterEach(() => {
    completionSendingPendingBillsEmail.restore();
    serverLogStub.restore();
  });

  it('should send an email after pending courseBills sending', async () => {
    const day = '2026-01-05T23:00:00.000Z';
    const emailSent = 2;
    const pendingCourseBillDeleted = 2;

    await sendingPendingBillsByEmailJob.onComplete(server, { day, emailSent, pendingCourseBillDeleted });
    sinon.assert.calledOnceWithExactly(completionSendingPendingBillsEmail, day, emailSent, pendingCourseBillDeleted);
  });
});
