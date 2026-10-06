const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const CourseSlot = require('../../../src/models/CourseSlot');
const TrainerBill = require('../../../src/models/TrainerBill');
const TrainerPayment = require('../../../src/models/TrainerPayment');
const TrainerPaymentsHelper = require('../../../src/helpers/trainerPayments');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const SinonMongoose = require('../sinonMongoose');
const { PENDING, PAID } = require('../../../src/helpers/constants');

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

  beforeEach(() => {
    trainerPaymentFind = sinon.stub(TrainerPayment, 'find');
  });

  afterEach(() => {
    trainerPaymentFind.restore();
  });

  it('should return the trainer payments with the given status', async () => {
    const trainerPayments = [{ _id: new ObjectId(), status: PAID }];
    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(trainerPayments, ['populate', 'sort', 'lean']));

    const result = await TrainerPaymentsHelper.list({ status: PAID });

    expect(result).toEqual(trainerPayments);
    SinonMongoose.calledOnceWithExactly(
      trainerPaymentFind,
      [
        { query: 'find', args: [{ status: { $in: [PAID] } }] },
        {
          query: 'populate',
          args: [{ path: 'trainerBill', select: 'number file', populate: { path: 'trainer', select: 'identity' } }],
        },
        { query: 'sort', args: [{ date: -1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should query every status when status is an array', async () => {
    const trainerPayments = [{ _id: new ObjectId(), status: PAID }, { _id: new ObjectId(), status: PENDING }];

    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries([trainerPayments], ['populate', 'sort', 'lean']));

    const result = await TrainerPaymentsHelper.list({ status: [PENDING, PAID] });
    expect(result).toEqual(trainerPayments);

    sinon.assert.calledOnceWithExactly(trainerPaymentFind, { status: { $in: [PENDING, PAID] } });
  });
});
