const { ObjectId } = require('mongodb');
const CourseSlot = require('../../../src/models/CourseSlot');
const TrainerBill = require('../../../src/models/TrainerBill');
const TrainerPayment = require('../../../src/models/TrainerPayment');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { trainer } = require('../../seed/authUsersSeed');
const { PENDING, PAID } = require('../../../src/helpers/constants');

const courseId = new ObjectId();
const stepId = new ObjectId();

const trainerBillId = new ObjectId();
const paidTrainerBillId = new ObjectId();
const courseSlotId = new ObjectId();
const paidCourseSlotId = new ObjectId();

const trainerPaymentId = new ObjectId();
const paidTrainerPaymentId = new ObjectId();

const courseSlotList = [
  {
    _id: courseSlotId,
    startDate: '2023-01-10T09:00:00.000Z',
    endDate: '2023-01-10T11:00:00.000Z',
    course: courseId,
    step: stepId,
    trainers: [trainer._id],
    trainerBillings: [{ trainer: trainer._id, trainerBill: trainerBillId }],
  },
  {
    _id: paidCourseSlotId,
    startDate: '2023-01-11T09:00:00.000Z',
    endDate: '2023-01-11T11:00:00.000Z',
    course: courseId,
    step: stepId,
    trainers: [trainer._id],
    trainerBillings: [{ trainer: trainer._id, trainerBill: paidTrainerBillId }],
  },
];

const trainerBillList = [
  {
    _id: trainerBillId,
    trainer: trainer._id,
    number: 'FACT_0001',
    courseSlots: [courseSlotId],
    amount: 100,
    submittedAt: '2023-01-01T10:00:00.000Z',
    file: { publicId: 'publicId', link: 'link' },
  },
  {
    _id: paidTrainerBillId,
    trainer: trainer._id,
    number: 'FACT_0099',
    courseSlots: [paidCourseSlotId],
    amount: 100,
    submittedAt: '2023-01-02T10:00:00.000Z',
    file: { publicId: 'publicId2', link: 'link2' },
  },
];

const trainerPaymentList = [
  {
    _id: trainerPaymentId,
    number: 'REG-00100',
    trainerBill: trainerBillId,
    amount: 100,
    status: PENDING,
  },
  {
    _id: paidTrainerPaymentId,
    number: 'REG-00101',
    trainerBill: paidTrainerBillId,
    amount: 100,
    status: PAID,
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    CourseSlot.create(courseSlotList),
    TrainerBill.create(trainerBillList),
    TrainerPayment.create(trainerPaymentList),
  ]);
};

module.exports = {
  populateDB,
  trainerBillId,
  paidTrainerBillId,
  trainerPaymentId,
  paidTrainerPaymentId,
};
