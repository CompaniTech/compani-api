const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const CourseSlot = require('../../../src/models/CourseSlot');
const TrainerBill = require('../../../src/models/TrainerBill');
const TrainerPayment = require('../../../src/models/TrainerPayment');
const TrainerPaymentsHelper = require('../../../src/helpers/trainerPayments');
const CoursesHelper = require('../../../src/helpers/courses');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const SinonMongoose = require('../sinonMongoose');
const { PENDING, PAID, TRAINER_SALARY } = require('../../../src/helpers/constants');

describe('update', () => {
  let trainerPaymentUpdateOne;

  beforeEach(() => {
    trainerPaymentUpdateOne = sinon.stub(TrainerPayment, 'updateOne');
  });

  afterEach(() => {
    trainerPaymentUpdateOne.restore();
  });

  it('should update the status of the trainer payment', async () => {
    const trainerPaymentId = new ObjectId();

    await TrainerPaymentsHelper.update(trainerPaymentId, { status: PAID });

    sinon.assert.calledOnceWithExactly(trainerPaymentUpdateOne, { _id: trainerPaymentId }, { $set: { status: PAID } });
  });
});

describe('remove', () => {
  let trainerPaymentFindOne;
  let trainerBillFindOne;
  let courseSlotUpdateMany;
  let trainerPaymentDeleteOne;
  let trainerBillDeleteOne;
  let deleteCourseFile;

  beforeEach(() => {
    trainerPaymentFindOne = sinon.stub(TrainerPayment, 'findOne');
    trainerBillFindOne = sinon.stub(TrainerBill, 'findOne');
    courseSlotUpdateMany = sinon.stub(CourseSlot, 'updateMany');
    trainerPaymentDeleteOne = sinon.stub(TrainerPayment, 'deleteOne');
    trainerBillDeleteOne = sinon.stub(TrainerBill, 'deleteOne');
    deleteCourseFile = sinon.stub(GCloudStorageHelper, 'deleteCourseFile');
  });

  afterEach(() => {
    trainerPaymentFindOne.restore();
    trainerBillFindOne.restore();
    courseSlotUpdateMany.restore();
    trainerPaymentDeleteOne.restore();
    trainerBillDeleteOne.restore();
    deleteCourseFile.restore();
  });

  it('should unlink the course slots, delete the payment, the trainer bill and its file', async () => {
    const trainerPaymentId = new ObjectId();
    const trainerBillId = new ObjectId();
    trainerPaymentFindOne.returns(SinonMongoose.stubChainedQueries({ trainerBill: trainerBillId }, ['lean']));
    trainerBillFindOne.returns(SinonMongoose.stubChainedQueries({ file: { publicId: 'publicId' } }, ['lean']));

    await TrainerPaymentsHelper.remove(trainerPaymentId);

    sinon.assert.calledOnceWithExactly(
      courseSlotUpdateMany,
      { 'trainerBillings.trainerBill': trainerBillId },
      { $pull: { trainerBillings: { trainerBill: trainerBillId } } }
    );
    sinon.assert.calledOnceWithExactly(trainerPaymentDeleteOne, { _id: trainerPaymentId });
    sinon.assert.calledOnceWithExactly(trainerBillDeleteOne, { _id: trainerBillId });
    sinon.assert.calledOnceWithExactly(deleteCourseFile, 'publicId');
  });
});

describe('list', () => {
  let trainerPaymentFind;
  let courseSlotFind;
  let getCourseTrainerSalaryFromSlots;

  beforeEach(() => {
    trainerPaymentFind = sinon.stub(TrainerPayment, 'find');
    courseSlotFind = sinon.stub(CourseSlot, 'find');
    getCourseTrainerSalaryFromSlots = sinon.stub(CoursesHelper, 'getCourseTrainerSalaryFromSlots');
  });

  afterEach(() => {
    trainerPaymentFind.restore();
    courseSlotFind.restore();
    getCourseTrainerSalaryFromSlots.restore();
  });

  it('should return the trainer payments with the given status', async () => {
    const trainerPayments = [{
      _id: new ObjectId(),
      status: PAID,
      trainerBill: { number: 'FACT', trainer: { identity: { lastname: 'Trainer' }, bic: 'WERTFRPP', iban: 'FR35' } },
    }];
    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(trainerPayments, ['populate', 'sort', 'lean']));
    courseSlotFind.returns(SinonMongoose.stubChainedQueries([], ['lean']));

    const result = await TrainerPaymentsHelper.list({ status: PAID });

    expect(result).toEqual([{
      ...trainerPayments[0],
      trainerBill: { number: 'FACT', trainer: { identity: { lastname: 'Trainer' }, hasBankDetails: true } },
    }]);
    SinonMongoose.calledOnceWithExactly(
      trainerPaymentFind,
      [
        { query: 'find', args: [{ status: { $in: [PAID] } }] },
        {
          query: 'populate',
          args: [{
            path: 'trainerBill',
            select: 'number file course',
            populate: [
              { path: 'trainer', select: 'identity bic iban' },
              {
                path: 'course',
                select: 'trainers billingPurchaseList rolesPerTrainer subProgram createdAt',
                populate: [
                  { path: 'subProgram', select: 'name trainerPriceVersions' },
                  { path: 'billingPurchaseList.billingItem', select: 'type' },
                ],
              },
            ],
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'trainerPaymentsXmlFileInfos', select: 'name', options: { isVendorUser: true } }],
        },
        { query: 'sort', args: [{ date: -1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      courseSlotFind,
      [
        {
          query: 'find',
          args: [{ course: { $in: [] } }, { course: 1, step: 1, startDate: 1, endDate: 1, trainers: 1 }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(getCourseTrainerSalaryFromSlots);
  });

  it('should return the planned salary of the course from billing purchase list or from slots', async () => {
    const trainerId = new ObjectId();
    const trainer = { _id: trainerId, identity: { lastname: 'Trainer' }, bic: 'WERTFRPP', iban: 'FR35' };
    const courseWithSalaryItem = {
      _id: new ObjectId(),
      trainers: [trainerId],
      billingPurchaseList: [{ billingItem: { type: TRAINER_SALARY }, price: 40, count: 1 }],
    };
    const courseWithoutSalaryItem = { _id: new ObjectId(), trainers: [trainerId, new ObjectId()] };
    const trainerPayments = [
      { _id: new ObjectId(), status: PAID, trainerBill: { number: 'FACT_1', trainer, course: courseWithSalaryItem } },
      {
        _id: new ObjectId(),
        status: PAID,
        trainerBill: { number: 'FACT_2', trainer, course: courseWithoutSalaryItem },
      },
    ];
    const courseSlots = [
      { _id: new ObjectId(), course: courseWithoutSalaryItem._id, trainers: [trainerId] },
      { _id: new ObjectId(), course: courseWithoutSalaryItem._id, trainers: [trainerId] },
    ];

    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(trainerPayments, ['populate', 'sort', 'lean']));
    courseSlotFind.returns(SinonMongoose.stubChainedQueries(courseSlots, ['lean']));
    getCourseTrainerSalaryFromSlots.returns(120);

    const result = await TrainerPaymentsHelper.list({ status: PAID });

    const formattedTrainer = { _id: trainerId, identity: { lastname: 'Trainer' }, hasBankDetails: true };
    expect(result).toEqual([
      {
        ...trainerPayments[0],
        trainerBill: {
          number: 'FACT_1',
          trainer: formattedTrainer,
          course: { _id: courseWithSalaryItem._id, plannedSalary: 40 },
        },
      },
      {
        ...trainerPayments[1],
        trainerBill: {
          number: 'FACT_2',
          trainer: formattedTrainer,
          course: { _id: courseWithoutSalaryItem._id, plannedSalary: 120 },
        },
      },
    ]);
    SinonMongoose.calledOnceWithExactly(
      courseSlotFind,
      [
        {
          query: 'find',
          args: [
            { course: { $in: [courseWithSalaryItem._id, courseWithoutSalaryItem._id] } },
            { course: 1, step: 1, startDate: 1, endDate: 1, trainers: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getCourseTrainerSalaryFromSlots,
      courseWithoutSalaryItem,
      trainerId,
      courseSlots
    );
  });

  it('should query every status when status is an array', async () => {
    const trainerPayments = [{ _id: new ObjectId(), status: PAID }, { _id: new ObjectId(), status: PENDING }];

    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(trainerPayments, ['populate', 'sort', 'lean']));
    courseSlotFind.returns(SinonMongoose.stubChainedQueries([], ['lean']));

    const result = await TrainerPaymentsHelper.list({ status: [PENDING, PAID] });
    expect(result).toEqual(trainerPayments);

    sinon.assert.calledOnceWithExactly(trainerPaymentFind, { status: { $in: [PENDING, PAID] } });
  });
});
