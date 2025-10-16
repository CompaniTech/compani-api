const sinon = require('sinon');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const CoursePaymentsHelper = require('../../../src/helpers/coursePayments');
const {
  PAYMENT,
  DIRECT_DEBIT,
  PENDING,
  BANK_TRANSFER,
  RECEIVED,
  CHECK,
  CASH,
  XML_GENERATED,
} = require('../../../src/helpers/constants');
const CourseBill = require('../../../src/models/CourseBill');
const CoursePaymentNumber = require('../../../src/models/CoursePaymentNumber');
const CoursePayment = require('../../../src/models/CoursePayment');
const SinonMongoose = require('../sinonMongoose');

describe('createCoursePayment', () => {
  let create;
  let findOneCourseBill;
  let findOneAndUpdateCoursePaymentsNumber;

  beforeEach(() => {
    create = sinon.stub(CoursePayment, 'create');
    findOneCourseBill = sinon.stub(CourseBill, 'findOne');
    findOneAndUpdateCoursePaymentsNumber = sinon.stub(CoursePaymentNumber, 'findOneAndUpdate');
  });

  afterEach(() => {
    create.restore();
    findOneCourseBill.restore();
    findOneAndUpdateCoursePaymentsNumber.restore();
  });

  it('should create a direct debit payment', async () => {
    const companyId = new ObjectId();
    const courseBillId = new ObjectId();
    const payload = {
      date: '2022-03-08T00:00:00.000Z',
      courseBill: courseBillId,
      netInclTaxes: 190,
      nature: PAYMENT,
      type: DIRECT_DEBIT,
    };
    const courseBill = { _id: courseBillId, companies: [companyId] };
    const lastPaymentNumber = { seq: 1 };

    findOneAndUpdateCoursePaymentsNumber.returns(SinonMongoose.stubChainedQueries(lastPaymentNumber, ['lean']));
    findOneCourseBill.returns(SinonMongoose.stubChainedQueries(courseBill, ['lean']));

    await CoursePaymentsHelper.createCoursePayment(payload);
    sinon.assert.calledOnceWithExactly(
      create,
      { ...payload, number: 'REG-00001', companies: [companyId], status: PENDING }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneCourseBill,
      [{ query: 'findOne', args: [{ _id: courseBillId }, { companies: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdateCoursePaymentsNumber,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ nature: PAYMENT }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }],
        },
        { query: 'lean' },
      ]);
  });

  it('should create a bank transfert payment', async () => {
    const companyId = new ObjectId();
    const courseBillId = new ObjectId();
    const payload = {
      date: '2022-03-08T00:00:00.000Z',
      courseBill: courseBillId,
      netInclTaxes: 190,
      nature: PAYMENT,
      type: BANK_TRANSFER,
    };
    const courseBill = { _id: courseBillId, companies: [companyId] };
    const lastPaymentNumber = { seq: 1 };

    findOneAndUpdateCoursePaymentsNumber.returns(SinonMongoose.stubChainedQueries(lastPaymentNumber, ['lean']));
    findOneCourseBill.returns(SinonMongoose.stubChainedQueries(courseBill, ['lean']));

    await CoursePaymentsHelper.createCoursePayment(payload);
    sinon.assert.calledOnceWithExactly(
      create,
      { ...payload, number: 'REG-00001', companies: [companyId], status: RECEIVED }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneCourseBill,
      [{ query: 'findOne', args: [{ _id: courseBillId }, { companies: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdateCoursePaymentsNumber,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ nature: PAYMENT }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }],
        },
        { query: 'lean' },
      ]);
  });

  it('should create a check payment', async () => {
    const companyId = new ObjectId();
    const courseBillId = new ObjectId();
    const payload = {
      date: '2022-03-08T00:00:00.000Z',
      courseBill: courseBillId,
      netInclTaxes: 190,
      nature: PAYMENT,
      type: CHECK,
    };
    const courseBill = { _id: courseBillId, companies: [companyId] };
    const lastPaymentNumber = { seq: 1 };

    findOneAndUpdateCoursePaymentsNumber.returns(SinonMongoose.stubChainedQueries(lastPaymentNumber, ['lean']));
    findOneCourseBill.returns(SinonMongoose.stubChainedQueries(courseBill, ['lean']));

    await CoursePaymentsHelper.createCoursePayment(payload);
    sinon.assert.calledOnceWithExactly(
      create,
      { ...payload, number: 'REG-00001', companies: [companyId], status: PENDING }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneCourseBill,
      [{ query: 'findOne', args: [{ _id: courseBillId }, { companies: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdateCoursePaymentsNumber,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ nature: PAYMENT }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }],
        },
        { query: 'lean' },
      ]);
  });

  it('should create a cash payment', async () => {
    const companyId = new ObjectId();
    const courseBillId = new ObjectId();
    const payload = {
      date: '2022-03-08T00:00:00.000Z',
      courseBill: courseBillId,
      netInclTaxes: 190,
      nature: PAYMENT,
      type: CASH,
    };
    const courseBill = { _id: courseBillId, companies: [companyId] };
    const lastPaymentNumber = { seq: 1 };

    findOneAndUpdateCoursePaymentsNumber.returns(SinonMongoose.stubChainedQueries(lastPaymentNumber, ['lean']));
    findOneCourseBill.returns(SinonMongoose.stubChainedQueries(courseBill, ['lean']));

    await CoursePaymentsHelper.createCoursePayment(payload);
    sinon.assert.calledOnceWithExactly(
      create,
      { ...payload, number: 'REG-00001', companies: [companyId], status: RECEIVED }
    );
    SinonMongoose.calledOnceWithExactly(
      findOneCourseBill,
      [{ query: 'findOne', args: [{ _id: courseBillId }, { companies: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdateCoursePaymentsNumber,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ nature: PAYMENT }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }],
        },
        { query: 'lean' },
      ]);
  });
});

describe('updateCoursePayment', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(CoursePayment, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should update a payment', async () => {
    const coursePaymentId = new ObjectId();
    const payload = {
      date: '2022-03-08T00:00:00.000Z',
      netInclTaxes: 190,
      type: DIRECT_DEBIT,
      status: RECEIVED,
    };

    await CoursePaymentsHelper.updateCoursePayment(coursePaymentId, payload);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: coursePaymentId }, { $set: payload });
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(CoursePayment, 'find');
  });

  afterEach(() => {
    find.restore();
  });

  it('should list payments', async () => {
    const paymentList = [
      {
        _id: new ObjectId(),
        status: RECEIVED,
        nature: PAYMENT,
        courseBill: { number: 'FACT_00001', payer: { company: { name: 'Structure' } }, isPayerCompany: true },
      },
      {
        _id: new ObjectId(),
        status: RECEIVED,
        nature: PAYMENT,
        courseBill: {
          number: 'FACT_00002',
          payer: { company: { fundingOrganisation: 'Financeur' } },
          isPayerCompany: false,
        },
      },
      {
        _id: new ObjectId(),
        status: XML_GENERATED,
        nature: PAYMENT,
        courseBill: { number: 'FACT_00001', payer: { company: { name: 'Structure' } }, isPayerCompany: true },
        xmlSEPAFileInfos: { name: 'lot de prelevements 1' },
      },
    ];
    find.returns(SinonMongoose.stubChainedQueries(paymentList, ['populate', 'setOptions', 'sort', 'lean']));

    const result = await CoursePaymentsHelper.list({ status: RECEIVED });

    expect(result).toEqual(paymentList);

    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ status: RECEIVED, nature: PAYMENT }] },
        {
          query: 'populate',
          args: [
            {
              path: 'courseBill',
              select: 'number payer',
              populate: [
                { path: 'payer.company', select: 'name' },
                { path: 'payer.fundingOrganisation', select: 'name' },
              ],
            },
          ],
        },
        {
          query: 'populate',
          args: [{ path: 'xmlSEPAFileInfos', select: 'name', options: { isVendorUser: true } }],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'sort', args: [{ updatedAt: -1 }] },
        { query: 'lean', args: [] },
      ]
    );
  });
});

describe('updateList', () => {
  let updateMany;

  beforeEach(() => {
    updateMany = sinon.stub(CoursePayment, 'updateMany');
  });

  afterEach(() => {
    updateMany.restore();
  });

  it('should update payments', async () => {
    const payload = {
      _ids: [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()],
      status: RECEIVED,
    };

    await CoursePaymentsHelper.updateList(payload);
    sinon.assert.calledOnceWithExactly(
      updateMany,
      { _id: { $in: payload._ids } },
      { $set: { status: payload.status } }
    );
  });
});
