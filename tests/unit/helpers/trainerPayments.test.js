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
  let getCourseTrainerSalary;

  beforeEach(() => {
    trainerPaymentFind = sinon.stub(TrainerPayment, 'find');
    getCourseTrainerSalary = sinon.stub(CoursesHelper, 'getCourseTrainerSalary');
  });

  afterEach(() => {
    trainerPaymentFind.restore();
    getCourseTrainerSalary.restore();
  });

  it('should return PAID trainer payments', async () => {
    const trainerPayments = [{
      _id: new ObjectId(),
      status: PAID,
      trainerBill: { number: 'FACT', trainer: { identity: { lastname: 'Trainer' }, bic: 'WERTFRPP', iban: 'FR35' } },
    }];
    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(trainerPayments, ['populate', 'sort', 'lean']));

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
                select: 'trainers billingPurchaseList subProgram',
                populate: [
                  { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } },
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
    sinon.assert.notCalled(getCourseTrainerSalary);
  });

  it('should return trainer payments formatted with trainer\'s planned salary', async () => {
    const trainerId = new ObjectId();
    const trainer = { _id: trainerId, identity: { lastname: 'Trainer' }, bic: 'WERTFRPP', iban: 'FR35' };
    const courseWithTrainerSalary = {
      _id: new ObjectId(),
      trainers: [trainerId],
      billingPurchaseList: [{ billingItem: { type: TRAINER_SALARY }, price: 40, count: 1 }],
    };
    const courseWithoutTrainerSalary = { _id: new ObjectId(), trainers: [trainerId, new ObjectId()] };
    const trainerPayments = [
      {
        _id: new ObjectId(),
        status: PAID,
        trainerBill: { number: 'FACT_1', trainer, course: courseWithTrainerSalary },
      },
      {
        _id: new ObjectId(),
        status: PAID,
        trainerBill: { number: 'FACT_2', trainer, course: courseWithoutTrainerSalary },
      },
    ];

    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(trainerPayments, ['populate', 'sort', 'lean']));
    getCourseTrainerSalary.onCall(0).returns(40);
    getCourseTrainerSalary.onCall(1).returns(undefined);

    const result = await TrainerPaymentsHelper.list({ status: PAID });

    const formattedTrainer = { _id: trainerId, identity: { lastname: 'Trainer' }, hasBankDetails: true };
    expect(result).toEqual([
      {
        ...trainerPayments[0],
        trainerBill: {
          number: 'FACT_1',
          trainer: formattedTrainer,
          course: { _id: courseWithTrainerSalary._id, plannedSalary: 40 },
        },
      },
      {
        ...trainerPayments[1],
        trainerBill: { number: 'FACT_2', trainer: formattedTrainer, course: { _id: courseWithoutTrainerSalary._id } },
      },
    ]);

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
                select: 'trainers billingPurchaseList subProgram',
                populate: [
                  { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } },
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
    sinon.assert.calledWithExactly(getCourseTrainerSalary.getCall(0), courseWithTrainerSalary);
    sinon.assert.calledWithExactly(getCourseTrainerSalary.getCall(1), courseWithoutTrainerSalary);
  });

  it('should return PAID and PENDING trainer payments', async () => {
    const trainerPayments = [{ _id: new ObjectId(), status: PAID }, { _id: new ObjectId(), status: PENDING }];

    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(trainerPayments, ['populate', 'sort', 'lean']));

    const result = await TrainerPaymentsHelper.list({ status: [PENDING, PAID] });
    expect(result).toEqual(trainerPayments);

    SinonMongoose.calledOnceWithExactly(
      trainerPaymentFind,
      [
        { query: 'find', args: [{ status: { $in: [PENDING, PAID] } }] },
        {
          query: 'populate',
          args: [{
            path: 'trainerBill',
            select: 'number file course',
            populate: [
              { path: 'trainer', select: 'identity bic iban' },
              {
                path: 'course',
                select: 'trainers billingPurchaseList subProgram',
                populate: [
                  { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } },
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
    sinon.assert.notCalled(getCourseTrainerSalary);
  });
});
