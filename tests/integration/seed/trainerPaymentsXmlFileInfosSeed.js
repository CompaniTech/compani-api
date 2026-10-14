const { ObjectId } = require('mongodb');
const CourseSlot = require('../../../src/models/CourseSlot');
const TrainerBill = require('../../../src/models/TrainerBill');
const TrainerPayment = require('../../../src/models/TrainerPayment');
const TrainerPaymentsXmlFileInfos = require('../../../src/models/TrainerPaymentsXmlFileInfos');
const VendorCompany = require('../../../src/models/VendorCompany');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');
const { trainer, trainerAndCoach } = require('../../seed/authUsersSeed');
const { PENDING, PAID } = require('../../../src/helpers/constants');

const courseId = new ObjectId();
const stepId = new ObjectId();

const trainerBillId = new ObjectId();
const noBankDetailsTrainerBillId = new ObjectId();
const linkedTrainerBillId = new ObjectId();
const paidTrainerBillId = new ObjectId();

const courseSlotList = [
  {
    _id: new ObjectId(),
    startDate: '2024-01-10T09:00:00.000Z',
    endDate: '2024-01-10T11:00:00.000Z',
    course: courseId,
    step: stepId,
    trainers: [trainer._id],
    trainerBillings: [{ trainer: trainer._id, trainerBill: trainerBillId }],
  },
  {
    _id: new ObjectId(),
    startDate: '2024-01-11T09:00:00.000Z',
    endDate: '2024-01-11T11:00:00.000Z',
    course: courseId,
    step: stepId,
    trainers: [trainerAndCoach._id],
    trainerBillings: [{ trainer: trainerAndCoach._id, trainerBill: noBankDetailsTrainerBillId }],
  },
  {
    _id: new ObjectId(),
    startDate: '2024-01-12T09:00:00.000Z',
    endDate: '2024-01-12T11:00:00.000Z',
    course: courseId,
    step: stepId,
    trainers: [trainer._id],
    trainerBillings: [{ trainer: trainer._id, trainerBill: linkedTrainerBillId }],
  },
  {
    _id: new ObjectId(),
    startDate: '2024-01-13T09:00:00.000Z',
    endDate: '2024-01-13T11:00:00.000Z',
    course: courseId,
    step: stepId,
    trainers: [trainer._id],
    trainerBillings: [{ trainer: trainer._id, trainerBill: paidTrainerBillId }],
  },
];

const trainerBillList = [
  { // trainer has bic/iban : payable
    _id: trainerBillId,
    trainer: trainer._id,
    number: 'FACT-X0001',
    courseSlots: [courseSlotList[0]._id],
    amount: 150,
    submittedAt: '2024-01-01T10:00:00.000Z',
    file: { publicId: 'publicId', link: 'link' },
  },
  { // trainer has no bic/iban
    _id: noBankDetailsTrainerBillId,
    trainer: trainerAndCoach._id,
    number: 'FACT-X0002',
    courseSlots: [courseSlotList[1]._id],
    amount: 200,
    submittedAt: '2024-01-02T10:00:00.000Z',
    file: { publicId: 'publicId2', link: 'link2' },
  },
  { // already linked to an existing xml file
    _id: linkedTrainerBillId,
    trainer: trainer._id,
    number: 'FACT-X0003',
    courseSlots: [courseSlotList[2]._id],
    amount: 90,
    submittedAt: '2024-01-03T10:00:00.000Z',
    file: { publicId: 'publicId3', link: 'link3' },
  },
  { // already paid, but not linked to any xml file
    _id: paidTrainerBillId,
    trainer: trainer._id,
    number: 'FACT-X0004',
    courseSlots: [courseSlotList[3]._id],
    amount: 60,
    submittedAt: '2024-01-04T10:00:00.000Z',
    file: { publicId: 'publicId4', link: 'link4' },
  },
];

const trainerPaymentId = new ObjectId();
const noBankDetailsPaymentId = new ObjectId();
const linkedPaymentId = new ObjectId();
const paidUnlinkedPaymentId = new ObjectId();

const trainerPaymentList = [
  { _id: trainerPaymentId, number: 'REG-X0001', trainerBill: trainerBillId, amount: 150, status: PENDING },
  {
    _id: noBankDetailsPaymentId,
    number: 'REG-X0002',
    trainerBill: noBankDetailsTrainerBillId,
    amount: 200,
    status: PENDING,
  },
  { _id: linkedPaymentId, number: 'REG-X0003', trainerBill: linkedTrainerBillId, amount: 90, status: PAID },
  {
    _id: paidUnlinkedPaymentId,
    number: 'REG-X0004',
    trainerBill: paidTrainerBillId,
    amount: 60,
    status: PAID,
  },
];

const trainerPaymentsXmlFileInfos = { trainerPayments: [linkedPaymentId], name: 'alreadyGenerated' };

const vendorCompany = {
  _id: new ObjectId(),
  name: 'Vendor Company',
  siret: '12345678901234',
  iban: 'FR9210096000302523177152Q14',
  bic: 'BPCEFRPP',
  ics: 'FR1234567894D',
  activityDeclarationNumber: '13736343575',
  address: {
    fullAddress: '32 Rue du Loup 33000 Bordeaux',
    street: '32 Rue du Loup',
    city: 'Bordeaux',
    zipCode: '33000',
    location: { type: 'Point', coordinates: [-0.573054, 44.837914] },
  },
  shareCapital: 123000,
  vat: 20,
  debitMandateTemplate: { driveId: '123456789', link: 'unlienversledoc' },
};

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    CourseSlot.create(courseSlotList),
    TrainerBill.create(trainerBillList),
    TrainerPayment.create(trainerPaymentList),
    TrainerPaymentsXmlFileInfos.create(trainerPaymentsXmlFileInfos),
    VendorCompany.create(vendorCompany),
  ]);
};

module.exports = {
  populateDB,
  trainerPaymentId,
  noBankDetailsPaymentId,
  linkedPaymentId,
  paidUnlinkedPaymentId,
  trainerBillId,
};
