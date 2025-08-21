const sinon = require('sinon');
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
    };

    await CoursePaymentsHelper.updateCoursePayment(coursePaymentId, payload);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: coursePaymentId }, { $set: payload });
  });
});
