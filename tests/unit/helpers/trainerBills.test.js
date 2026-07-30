const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const CourseSlot = require('../../../src/models/CourseSlot');
const TrainerBill = require('../../../src/models/TrainerBill');
const CourseSlotsHelper = require('../../../src/helpers/courseSlots');
const EmailHelper = require('../../../src/helpers/email');
const TrainerBillsHelper = require('../../../src/helpers/trainerBills');
const SinonMongoose = require('../sinonMongoose');
const { INVOICED, PAID } = require('../../../src/helpers/constants');

describe('createBill', () => {
  let courseSlotFind;
  let trainerBillCreate;
  let courseSlotUpdateMany;
  let getHourlyAmount;
  let sendTrainerBillEmail;

  beforeEach(() => {
    courseSlotFind = sinon.stub(CourseSlot, 'find');
    trainerBillCreate = sinon.stub(TrainerBill, 'create');
    courseSlotUpdateMany = sinon.stub(CourseSlot, 'updateMany');
    getHourlyAmount = sinon.stub(CourseSlotsHelper, 'getHourlyAmount');
    sendTrainerBillEmail = sinon.stub(EmailHelper, 'sendTrainerBillEmail');
  });

  afterEach(() => {
    courseSlotFind.restore();
    trainerBillCreate.restore();
    courseSlotUpdateMany.restore();
    getHourlyAmount.restore();
    sendTrainerBillEmail.restore();
  });

  it('should create a trainer bill and link it to the course slots', async () => {
    const credentials = { _id: new ObjectId(), identity: { firstname: 'Jean', lastname: 'Dupont' } };
    const courseSlotIds = [new ObjectId(), new ObjectId()];
    const trainerBillId = new ObjectId();
    const payload = { courseSlots: courseSlotIds, number: 'FACT_0001', file: 'file' };

    const courseSlots = [
      {
        _id: courseSlotIds[0],
        startDate: new Date('2020-01-01T10:00:00.000Z'),
        endDate: new Date('2020-01-01T11:30:00.000Z'),
      },
      {
        _id: courseSlotIds[1],
        startDate: new Date('2020-01-01T09:00:00.000Z'),
        endDate: new Date('2020-01-01T10:00:00.000Z'),
      },
    ];

    courseSlotFind.returns(SinonMongoose.stubChainedQueries(courseSlots, ['populate', 'sort', 'lean']));
    getHourlyAmount.onCall(0).returns(50);
    getHourlyAmount.onCall(1).returns(50);
    trainerBillCreate.returns({ _id: trainerBillId });

    const result = await TrainerBillsHelper.createBill(payload, credentials);

    expect(result).toEqual({ _id: trainerBillId });

    SinonMongoose.calledOnceWithExactly(
      courseSlotFind,
      [
        { query: 'find', args: [{ _id: { $in: courseSlotIds } }] },
        { query: 'populate', args: [{ path: 'step', select: '_id' }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'subProgram',
            populate: { path: 'subProgram', select: 'priceVersions' },
          }],
        },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      trainerBillCreate,
      {
        trainer: credentials._id,
        number: 'FACT_0001',
        status: INVOICED,
        courseSlots: courseSlotIds,
        amount: '125',
        submittedAt: sinon.match.string,
      }
    );
    sinon.assert.calledOnceWithExactly(
      courseSlotUpdateMany,
      { _id: { $in: courseSlotIds } },
      { $push: { trainerBills: { trainer: credentials._id, trainerBillId } } }
    );
    sinon.assert.calledOnceWithExactly(sendTrainerBillEmail, 'FACT_0001', '125', 'Jean DUPONT', courseSlots, 'file');
  });

  it('should count a collective session amount only once, whatever the number of attending trainees', async () => {
    const credentials = { _id: new ObjectId(), identity: { firstname: 'Jean', lastname: 'Dupont' } };
    const courseSlotIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const trainerBillId = new ObjectId();
    const payload = { courseSlots: courseSlotIds, number: 'FACT_0003', file: 'file' };

    const courseSlots = [
      {
        _id: courseSlotIds[0],
        startDate: new Date('2020-01-01T09:00:00.000Z'),
        endDate: new Date('2020-01-01T11:00:00.000Z'),
      },
      {
        _id: courseSlotIds[1],
        startDate: new Date('2020-01-01T09:00:00.000Z'),
        endDate: new Date('2020-01-01T11:00:00.000Z'),
      },
      {
        _id: courseSlotIds[2],
        startDate: new Date('2020-01-02T09:00:00.000Z'),
        endDate: new Date('2020-01-02T10:00:00.000Z'),
      },
    ];

    courseSlotFind.returns(SinonMongoose.stubChainedQueries(courseSlots, ['populate', 'sort', 'lean']));
    getHourlyAmount.onCall(0).returns(50);
    getHourlyAmount.onCall(1).returns(70);
    trainerBillCreate.returns({ _id: trainerBillId });

    await TrainerBillsHelper.createBill(payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseSlotFind,
      [
        { query: 'find', args: [{ _id: { $in: courseSlotIds } }] },
        { query: 'populate', args: [{ path: 'step', select: '_id' }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'subProgram',
            populate: { path: 'subProgram', select: 'priceVersions' },
          }],
        },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      trainerBillCreate,
      {
        trainer: credentials._id,
        number: 'FACT_0003',
        status: INVOICED,
        courseSlots: courseSlotIds,
        amount: '170',
        submittedAt: sinon.match.string,
      }
    );
    sinon.assert.calledOnceWithExactly(
      courseSlotUpdateMany,
      { _id: { $in: courseSlotIds } },
      { $push: { trainerBills: { trainer: credentials._id, trainerBillId } } }
    );
    sinon.assert.calledOnceWithExactly(sendTrainerBillEmail, 'FACT_0003', '170', 'Jean DUPONT', courseSlots, 'file');
  });
});

describe('update', () => {
  let trainerBillUpdateOne;

  beforeEach(() => {
    trainerBillUpdateOne = sinon.stub(TrainerBill, 'updateOne');
  });

  afterEach(() => {
    trainerBillUpdateOne.restore();
  });

  it('should update the trainer bill status', async () => {
    const trainerBillId = new ObjectId();

    await TrainerBillsHelper.update(trainerBillId, { status: PAID });

    sinon.assert.calledOnceWithExactly(trainerBillUpdateOne, { _id: trainerBillId }, { $set: { status: PAID } });
  });
});

describe('remove', () => {
  let courseSlotUpdateMany;
  let trainerBillDeleteOne;

  beforeEach(() => {
    courseSlotUpdateMany = sinon.stub(CourseSlot, 'updateMany');
    trainerBillDeleteOne = sinon.stub(TrainerBill, 'deleteOne');
  });

  afterEach(() => {
    courseSlotUpdateMany.restore();
    trainerBillDeleteOne.restore();
  });

  it('should unlink the course slots and delete the trainer bill', async () => {
    const trainerBillId = new ObjectId();

    await TrainerBillsHelper.remove(trainerBillId);

    sinon.assert.calledOnceWithExactly(
      courseSlotUpdateMany,
      { 'trainerBills.trainerBillId': trainerBillId },
      { $pull: { trainerBills: { trainerBillId } } }
    );
    sinon.assert.calledOnceWithExactly(trainerBillDeleteOne, { _id: trainerBillId });
  });
});
