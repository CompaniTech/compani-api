const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const CourseSlot = require('../../../src/models/CourseSlot');
const TrainerInvoice = require('../../../src/models/TrainerInvoice');
const CourseSlotsHelper = require('../../../src/helpers/courseSlots');
const EmailHelper = require('../../../src/helpers/email');
const TrainerInvoicesHelper = require('../../../src/helpers/trainerInvoices');
const SinonMongoose = require('../sinonMongoose');
const { INVOICED } = require('../../../src/helpers/constants');

describe('createInvoice', () => {
  let courseSlotFind;
  let trainerInvoiceCreate;
  let courseSlotUpdateMany;
  let getHourlyAmount;
  let sendTrainerInvoiceEmail;

  beforeEach(() => {
    courseSlotFind = sinon.stub(CourseSlot, 'find');
    trainerInvoiceCreate = sinon.stub(TrainerInvoice, 'create');
    courseSlotUpdateMany = sinon.stub(CourseSlot, 'updateMany');
    getHourlyAmount = sinon.stub(CourseSlotsHelper, 'getHourlyAmount');
    sendTrainerInvoiceEmail = sinon.stub(EmailHelper, 'sendTrainerInvoiceEmail');
  });

  afterEach(() => {
    courseSlotFind.restore();
    trainerInvoiceCreate.restore();
    courseSlotUpdateMany.restore();
    getHourlyAmount.restore();
    sendTrainerInvoiceEmail.restore();
  });

  it('should create a trainer invoice and link it to the course slots', async () => {
    const credentials = { _id: new ObjectId(), identity: { firstname: 'Jean', lastname: 'Dupont' } };
    const courseSlotIds = [new ObjectId(), new ObjectId()];
    const trainerInvoiceId = new ObjectId();
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
    trainerInvoiceCreate.returns({ _id: trainerInvoiceId });

    const result = await TrainerInvoicesHelper.createInvoice(payload, credentials);

    expect(result).toEqual({ _id: trainerInvoiceId });

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
      trainerInvoiceCreate,
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
      { $push: { trainerBills: { trainer: credentials._id, trainerInvoice: trainerInvoiceId } } }
    );
    sinon.assert.calledOnceWithExactly(sendTrainerInvoiceEmail, 'FACT_0001', '125', 'Jean DUPONT', courseSlots, 'file');
  });

  it('should count a collective session amount only once, whatever the number of attending trainees', async () => {
    const credentials = { _id: new ObjectId(), identity: { firstname: 'Jean', lastname: 'Dupont' } };
    const courseSlotIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const trainerInvoiceId = new ObjectId();
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
    trainerInvoiceCreate.returns({ _id: trainerInvoiceId });

    await TrainerInvoicesHelper.createInvoice(payload, credentials);

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
      trainerInvoiceCreate,
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
      { $push: { trainerBills: { trainer: credentials._id, trainerInvoice: trainerInvoiceId } } }
    );
    sinon.assert.calledOnceWithExactly(sendTrainerInvoiceEmail, 'FACT_0003', '170', 'Jean DUPONT', courseSlots, 'file');
  });
});
