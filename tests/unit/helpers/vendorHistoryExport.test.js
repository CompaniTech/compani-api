/* eslint-disable max-len */
const { ObjectId } = require('mongodb');
const has = require('lodash/has');
const get = require('lodash/get');
const { expect } = require('expect');
const sinon = require('sinon');
const SinonMongoose = require('../sinonMongoose');
const CourseHelper = require('../../../src/helpers/courses');
const ExportHelper = require('../../../src/helpers/vendorHistoryExport');
const UtilsHelper = require('../../../src/helpers/utils');
const {
  INTRA,
  INTER_B2B,
  ON_SITE,
  REMOTE,
  E_LEARNING,
  PUBLISHED,
  EXPECTATIONS,
  END_OF_COURSE,
  PAYMENT,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  NO_DATA,
  CHECK,
  REFUND,
  ESTIMATED_START_DATE_EDITION,
  WEBAPP,
  MOBILE,
  INTRA_HOLDING,
  SELF_POSITIONNING,
  SINGLE,
  RECEIVED,
  PENDING,
  PRESENT,
  MISSING,
} = require('../../../src/helpers/constants');
const CourseSlot = require('../../../src/models/CourseSlot');
const Course = require('../../../src/models/Course');
const CourseSmsHistory = require('../../../src/models/CourseSmsHistory');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const Questionnaire = require('../../../src/models/Questionnaire');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const CourseBill = require('../../../src/models/CourseBill');
const CourseCreditNote = require('../../../src/models/CourseCreditNote');
const CoursePayment = require('../../../src/models/CoursePayment');
const CourseHistory = require('../../../src/models/CourseHistory');
const ActivityHistory = require('../../../src/models/ActivityHistory');

describe('exportCourseHistory', () => {
  const traineeList = [
    { _id: new ObjectId(), firstMobileConnectionDate: new Date() },
    { _id: new ObjectId(), firstMobileConnectionDate: new Date() },
    { _id: new ObjectId() },
    { _id: new ObjectId() },
    { _id: new ObjectId() },
  ];
  const activityListIds = [new ObjectId(), new ObjectId(), new ObjectId()];
  const activityHistoryList = [
    { _id: new ObjectId(), user: traineeList[3]._id, activity: activityListIds[0] },
    { _id: new ObjectId(), user: traineeList[3]._id, activity: activityListIds[1] },
    { _id: new ObjectId(), user: traineeList[3]._id, activity: activityListIds[2] },
    { _id: new ObjectId(), user: traineeList[4]._id, activity: activityListIds[2] },
  ];

  const stepList = [
    { _id: new ObjectId(), name: 'étape 1', type: ON_SITE, activities: [] },
    { _id: new ObjectId(), name: 'étape 2', type: REMOTE, activities: [] },
    { _id: new ObjectId(), name: 'étape 3', type: E_LEARNING, activities: activityListIds },
  ];

  const programIdList = [new ObjectId(), new ObjectId()];

  const subProgramList = [
    {
      _id: new ObjectId(),
      name: 'subProgram 1',
      program: { _id: programIdList[0], name: 'Program 1' },
      steps: [stepList[0], stepList[1]],
    },
    {
      _id: new ObjectId(),
      name: 'subProgram 2',
      program: { _id: programIdList[1], name: 'Program 2' },
      steps: [stepList[0], stepList[2]],
    },
  ];
  const trainersList = [
    { _id: new ObjectId(), identity: { firstname: 'Gilles', lastname: 'Formateur' } },
    { _id: new ObjectId(), identity: { firstname: 'Rihanna', lastname: 'Fenty' } },
  ];
  const operationsRepresentative = { _id: new ObjectId(), identity: { firstname: 'Aline', lastname: 'Contact-Com' } };

  const courseIdList = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];

  const courseSlotList = [
    {
      _id: new ObjectId(),
      course: courseIdList[0],
      startDate: '2021-05-01T08:00:00.000Z',
      endDate: '2021-05-01T10:00:00.000Z',
      attendances: [{ trainee: traineeList[0]._id, status: PRESENT }, { trainee: traineeList[1]._id, status: MISSING }],
    },
    {
      _id: new ObjectId(),
      course: courseIdList[0],
      startDate: '2021-05-01T14:00:00.000Z',
      endDate: '2021-05-01T16:00:00.000Z',
      attendances: [{ trainee: traineeList[0]._id, status: PRESENT }, { trainee: traineeList[1]._id, status: PRESENT }],
    },
    {
      _id: new ObjectId(),
      course: courseIdList[1],
      startDate: '2021-02-01T08:00:00.000Z',
      endDate: '2021-02-01T10:00:00.000Z',
      attendances: [{ trainee: traineeList[1]._id, status: PRESENT }, { trainee: traineeList[3]._id, status: PRESENT }],
    },
    {
      _id: new ObjectId(),
      course: courseIdList[1],
      startDate: '2021-02-02T08:00:00.000Z',
      endDate: '2021-02-02T10:00:00.000Z',
      attendances: [{ trainee: traineeList[1]._id, status: PRESENT }, { trainee: traineeList[3]._id, status: PRESENT }],
    },
    {
      _id: new ObjectId(),
      course: courseIdList[1],
      step: new ObjectId(),
    },
    {
      _id: new ObjectId(),
      course: courseIdList[4],
      startDate: '2021-02-09T08:00:00.000Z',
      endDate: '2021-02-09T10:00:00.000Z',
      attendances: [{ trainee: traineeList[0]._id, status: PRESENT }],
    },
    {
      _id: new ObjectId(),
      course: courseIdList[5],
      startDate: '2021-02-09T08:00:00.000Z',
      endDate: '2021-02-09T10:00:00.000Z',
      attendances: [{ trainee: traineeList[0]._id, status: PRESENT }],
    },
  ];
  const company = { _id: new ObjectId(), name: 'Test SAS', holding: { name: 'Société mère' } };
  const otherCompany = { _id: new ObjectId(), name: 'Autre structure' };
  const holding = { _id: new ObjectId(), name: 'Société mère' };
  const courseList = [
    // 0
    {
      _id: courseIdList[0],
      type: INTRA,
      companies: [company],
      subProgram: subProgramList[0],
      misc: 'group 1',
      trainers: [trainersList[0]],
      operationsRepresentative,
      contact: operationsRepresentative,
      trainees: [traineeList[0], traineeList[1], traineeList[2]],
      slotsToPlan: [],
      slots: [courseSlotList[0], courseSlotList[1]],
      expectedBillsCount: 2,
      archivedAt: '2024-07-07T22:00:00.000Z',
      createdAt: '2018-01-07T17:33:55.000Z',
      prices: [{ global: 3000, company: company._id }],
      bills: [
        {
          course: courseIdList[0],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00001',
          courseCreditNote: { courseBill: new ObjectId() },
          coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
        },
        {
          course: courseIdList[0],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00002',
          courseCreditNote: null,
          coursePayments: [{ netInclTaxes: 110, nature: PAYMENT, status: RECEIVED }],
        },
      ],
    },
    // 1
    {
      _id: courseIdList[1],
      type: INTER_B2B,
      companies: [company, otherCompany],
      subProgram: subProgramList[1],
      misc: 'group 2',
      estimatedStartDate: '2019-01-01T08:00:00',
      trainers: [trainersList[0], trainersList[1]],
      operationsRepresentative,
      contact: operationsRepresentative,
      trainees: [traineeList[3], traineeList[4]],
      slotsToPlan: [courseSlotList[4]],
      slots: [courseSlotList[2], courseSlotList[3]],
      createdAt: '2018-01-07T17:33:55.000Z',
      prices: [{ global: 2500, trainerFees: 250, company: otherCompany._id }],
      bills: [
        {
          course: courseIdList[1],
          mainFee: { price: 1200, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00003',
          courseCreditNote: { courseBill: new ObjectId() },
          coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
        },
        {
          course: courseIdList[1],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00004',
          courseCreditNote: null,
          coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
        },
        {
          course: courseIdList[1],
          mainFee: { price: 120, count: 1 },
          company: otherCompany,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00005',
          courseCreditNote: null,
          coursePayments: [{ netInclTaxes: 110, nature: PAYMENT, status: PENDING }],
        },
      ],
    },
    // 2
    {
      _id: courseIdList[2],
      type: INTRA_HOLDING,
      holding,
      companies: [],
      subProgram: subProgramList[1],
      misc: 'group 3',
      estimatedStartDate: '2022-01-01T08:00:00',
      trainers: [trainersList[0]],
      operationsRepresentative,
      contact: operationsRepresentative,
      trainees: [],
      slotsToPlan: [],
      slots: [],
      bills: [],
      createdAt: '2018-01-07T17:33:55.000Z',
    },
    // 3
    {
      _id: courseIdList[3],
      type: INTRA,
      companies: [company],
      subProgram: subProgramList[0],
      misc: 'group 1',
      trainers: [trainersList[0]],
      operationsRepresentative,
      contact: operationsRepresentative,
      trainees: [traineeList[0], traineeList[1], traineeList[2]],
      slotsToPlan: [],
      slots: [],
      expectedBillsCount: 3,
      createdAt: '2018-01-07T17:33:55.000Z',
      bills: [
        {
          course: courseIdList[3],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00010',
          courseCreditNote: { courseBill: new ObjectId() },
          coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
        },
        {
          course: courseIdList[3],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00011',
          courseCreditNote: null,
          coursePayments: [{ netInclTaxes: 110, nature: PAYMENT, status: RECEIVED }],
        },
        {
          course: courseIdList[3],
          mainFee: { price: 200, count: 1 },
          company,
          payer: { name: 'Compani Test' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00012',
          courseCreditNote: null,
        },
        {
          course: courseIdList[3],
          mainFee: { price: 120, count: 2 },
          company,
          payer: { name: 'Alenvi' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00013',
          courseCreditNote: null,
          coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
        },
        { // non-validated invoice
          course: courseIdList[3],
          mainFee: { price: 120, count: 2 },
          company,
          payer: { name: 'Test' },
          number: 'FACT-00014',
          courseCreditNote: null,
          coursePayments: [],
        },
      ],
    },
    // 4
    {
      _id: courseIdList[4],
      type: INTER_B2B,
      companies: [otherCompany],
      subProgram: subProgramList[0],
      misc: 'group 1',
      createdAt: '2018-01-07T17:33:55.000Z',
      trainers: [trainersList[0]],
      operationsRepresentative,
      contact: operationsRepresentative,
      trainees: [traineeList[0], traineeList[1]],
      slotsToPlan: [],
      slots: [courseSlotList[5]],
      expectedBillsCount: 2,
      bills: [
        {
          course: courseIdList[4],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00010',
          courseCreditNote: null,
          coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
        },
      ],
    },
    // 5
    {
      _id: courseIdList[5],
      type: SINGLE,
      companies: [company],
      subProgram: subProgramList[0],
      misc: 'Trainee 1',
      trainers: [trainersList[0]],
      operationsRepresentative,
      contact: operationsRepresentative,
      trainees: [traineeList[0]],
      slotsToPlan: [],
      slots: [courseSlotList[6]],
      expectedBillsCount: 3,
      createdAt: '2018-01-07T17:33:55.000Z',
      bills: [
        {
          course: courseIdList[5],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00010',
          courseCreditNote: { courseBill: new ObjectId() },
          coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
        },
        {
          course: courseIdList[5],
          mainFee: { price: 120, count: 1 },
          company,
          payer: { name: 'APA Paris' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00011',
          courseCreditNote: null,
          coursePayments: [{ netInclTaxes: 110, nature: PAYMENT, status: RECEIVED }],
        },
        {
          course: courseIdList[5],
          mainFee: { price: 200, count: 1 },
          company,
          payer: { name: 'Compani Test' },
          billedAt: '2022-03-08T00:00:00.000Z',
          number: 'FACT-00012',
          courseCreditNote: null,
        },
        { // non-validated invoice
          course: courseIdList[5],
          mainFee: { price: 120, count: 2 },
          company,
          payer: { name: 'Test' },
          number: 'FACT-00014',
          courseCreditNote: null,
          coursePayments: [],
        },
      ],
    },
  ];

  const questionnaireList = [
    { _id: new ObjectId(), type: EXPECTATIONS, name: 'attentes', status: PUBLISHED },
    { _id: new ObjectId(), type: END_OF_COURSE, name: 'satisfaction', status: PUBLISHED },
  ];
  const questionnaireHistoriesList = [
    { _id: new ObjectId(), course: courseList[0]._id, user: traineeList[0]._id, questionnaire: questionnaireList[0] },
    { _id: new ObjectId(), course: courseList[0]._id, user: traineeList[0]._id, questionnaire: questionnaireList[1] },
    { _id: new ObjectId(), course: courseList[0]._id, user: traineeList[1]._id, questionnaire: questionnaireList[1] },
    { _id: new ObjectId(), course: courseList[0]._id, user: traineeList[2]._id, questionnaire: questionnaireList[0] },
    { _id: new ObjectId(), course: courseList[1]._id, user: traineeList[3]._id, questionnaire: questionnaireList[0] },
    { _id: new ObjectId(), course: courseList[1]._id, user: traineeList[3]._id, questionnaire: questionnaireList[1] },
  ];
  const estimatedStartDateHistoriesList = [
    {
      _id: new ObjectId(),
      course: courseList[1]._id,
      update: { estimatedStartDate: { to: '2019-01-01T08:00:00.000Z' } },
    },
    {
      _id: new ObjectId(),
      course: courseList[2]._id,
      update: { estimatedStartDate: { to: '2021-12-01T10:00:00.000Z' } },
    },
  ];

  const credentials = { company: { _id: new ObjectId() }, role: { vendor: { name: TRAINING_ORGANISATION_MANAGER } } };

  let findCourseSlot;
  let findCourse;
  let groupSlotsByDate;
  let getTotalDurationForExport;
  let findCourseSmsHistory;
  let findAttendanceSheet;
  let findQuestionnaireHistory;
  let findCourseHistory;
  let findActivityHistory;
  let formatPrice;

  beforeEach(() => {
    findCourseSlot = sinon.stub(CourseSlot, 'find');
    findCourse = sinon.stub(Course, 'find');
    groupSlotsByDate = sinon.stub(CourseHelper, 'groupSlotsByDate');
    getTotalDurationForExport = sinon.stub(UtilsHelper, 'getTotalDurationForExport');
    findCourseSmsHistory = sinon.stub(CourseSmsHistory, 'find');
    findAttendanceSheet = sinon.stub(AttendanceSheet, 'find');
    findQuestionnaireHistory = sinon.stub(QuestionnaireHistory, 'find');
    findCourseHistory = sinon.stub(CourseHistory, 'find');
    findActivityHistory = sinon.stub(ActivityHistory, 'find');
    formatPrice = sinon.stub(UtilsHelper, 'formatPrice');
  });

  afterEach(() => {
    findCourseSlot.restore();
    findCourse.restore();
    groupSlotsByDate.restore();
    getTotalDurationForExport.restore();
    findCourseSmsHistory.restore();
    findAttendanceSheet.restore();
    findQuestionnaireHistory.restore();
    findCourseHistory.restore();
    findActivityHistory.restore();
    formatPrice.restore();
  });

  it('should return an empty array if no course', async () => {
    findCourseSlot.returns(SinonMongoose.stubChainedQueries(courseSlotList, ['lean']));
    findCourse.returns(SinonMongoose.stubChainedQueries([], ['select', 'populate', 'lean']));

    const result = await ExportHelper.exportCourseHistory('2021-01-14T23:00:00.000Z', '2022-01-20T22:59:59.000Z', credentials);

    expect(result).toEqual([[NO_DATA]]);
    SinonMongoose.calledOnceWithExactly(
      findCourseSlot,
      [
        {
          query: 'find',
          args: [{ startDate: { $lte: '2022-01-20T22:59:59.000Z' }, endDate: { $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        {
          query: 'find',
          args: [{
            $or: [
              { _id: { $in: courseSlotList.map(slot => slot.course) } },
              {
                estimatedStartDate: { $lte: '2022-01-20T22:59:59.000Z', $gte: '2021-01-14T23:00:00.000Z' },
                archivedAt: { $exists: false },
              },
            ],
          }],
        },
        { query: 'select', args: ['_id type misc estimatedStartDate expectedBillsCount archivedAt createdAt prices'] },
        {
          query: 'populate',
          args: [{
            path: 'companies',
            select: 'name',
            populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
          }],
        },
        { query: 'populate', args: [{ path: 'holding', select: 'name' }] },
        {
          query: 'populate',
          args: [
            {
              path: 'subProgram',
              select: 'name steps program',
              populate: [{ path: 'program', select: 'name' }, { path: 'steps', select: 'type activities' }],
            }],
        },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'operationsRepresentative', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'contact', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'attendances startDate endDate',
            populate: {
              path: 'attendances',
              options: {
                isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                  .includes(get(credentials, 'role.vendor.name')),
              },
            },
          }],
        },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'firstMobileConnectionDate' }] },
        {
          query: 'populate',
          args: [{
            path: 'bills',
            select: 'payer billedAt mainFee billingPurchaseList',
            options: { isVendorUser: has(credentials, 'role.vendor') },
            populate: [
              { path: 'payer.fundingOrganisation', select: 'name' },
              { path: 'payer.company', select: 'name' },
              { path: 'courseCreditNote', options: { isVendorUser: !!get(credentials, 'role.vendor') }, select: '_id' },
              {
                path: 'coursePayments',
                select: 'netInclTaxes nature status',
                options: { isVendorUser: !!get(credentials, 'role.vendor') },
              },
            ],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(groupSlotsByDate);
    sinon.assert.notCalled(getTotalDurationForExport);
    sinon.assert.notCalled(findQuestionnaireHistory);
    sinon.assert.notCalled(findCourseSmsHistory);
    sinon.assert.notCalled(findAttendanceSheet);
    sinon.assert.notCalled(findCourseHistory);
    sinon.assert.notCalled(findActivityHistory);
    sinon.assert.notCalled(formatPrice);
  });

  it('should return an array with the header and 4 rows', async () => {
    findCourseSlot.returns(SinonMongoose.stubChainedQueries(courseSlotList, ['lean']));
    findCourse.returns(SinonMongoose.stubChainedQueries(courseList, ['select', 'populate', 'lean']));
    findQuestionnaireHistory.returns(
      SinonMongoose.stubChainedQueries(questionnaireHistoriesList, ['select', 'populate', 'setOptions', 'lean'])
    );
    findCourseHistory.returns(SinonMongoose.stubChainedQueries(estimatedStartDateHistoriesList));
    groupSlotsByDate.onCall(0).returns([[courseSlotList[0], courseSlotList[1]]]);
    groupSlotsByDate.onCall(1).returns([[courseSlotList[2]], [courseSlotList[3]]]);
    groupSlotsByDate.onCall(2).returns([]);
    groupSlotsByDate.onCall(3).returns([]);
    groupSlotsByDate.onCall(4).returns([[courseSlotList[5]]]);
    groupSlotsByDate.onCall(5).returns([[courseSlotList[6]]]);
    getTotalDurationForExport.onCall(0).returns('4,00');
    getTotalDurationForExport.onCall(1).returns('4,00');
    getTotalDurationForExport.onCall(2).returns('0,00');
    getTotalDurationForExport.onCall(3).returns('0,00');
    getTotalDurationForExport.onCall(4).returns('2,00');
    getTotalDurationForExport.onCall(5).returns('2,00');
    findCourseSmsHistory.returns(SinonMongoose.stubChainedQueries(
      [{ course: courseList[0]._id }, { course: courseList[0]._id }, { course: courseList[1]._id }],
      ['select', 'lean']
    ));
    findAttendanceSheet.returns(SinonMongoose.stubChainedQueries(
      [{ course: courseList[0]._id }],
      ['select', 'setOptions', 'lean']
    ));
    findActivityHistory.onCall(0).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistory.onCall(1).returns(SinonMongoose.stubChainedQueries(activityHistoryList, ['lean']));
    findActivityHistory.onCall(2).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistory.onCall(3).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistory.onCall(4).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findActivityHistory.onCall(5).returns(SinonMongoose.stubChainedQueries([], ['lean']));
    formatPrice.onCall(0).returns('3000,00 €');
    formatPrice.onCall(1).returns('2500,00 €');
    formatPrice.onCall(2).returns('250,00 €');

    const result = await ExportHelper
      .exportCourseHistory('2021-01-14T23:00:00.000Z', '2022-01-20T22:59:59.000Z', credentials);

    expect(result).toEqual([
      [
        'Identifiant',
        'Type',
        'Payeur',
        'Structure',
        'Société mère',
        'Programme',
        'Id programme',
        'Sous-Programme',
        'Infos complémentaires',
        'Intervenant·es',
        'Début de formation',
        'Fin de formation',
        'Chargé des opérations',
        'Contact pour la formation',
        'Nombre d\'inscrits',
        'Nombre de dates',
        'Nombre de créneaux',
        'Nombre de créneaux à planifier',
        'Durée Totale',
        'Nombre de SMS envoyés',
        'Nombre de personnes connectées à l\'app',
        'Complétion eLearning moyenne',
        'Nombre de réponses au questionnaire de recueil des attentes',
        'Nombre de réponses au questionnaire de satisfaction',
        'Date de démarrage souhaitée',
        'Première date de démarrage souhaitée',
        'Nombre de feuilles d\'émargement chargées',
        'Nombre de présences',
        'Nombre d\'absences',
        'Nombre d\'émargements non remplis',
        'Nombre de stagiaires non prévus',
        'Nombre de présences non prévues',
        'Avancement',
        'Archivée',
        'Date d\'archivage',
        'Prix de la formation',
        'Nombre de factures',
        'Facturée',
        'Montant facturé',
        'Montant réglé',
        'Solde',
        'Date de création',
      ],
      [
        courseList[0]._id,
        'Intra',
        'APA Paris',
        'Test SAS',
        'Société mère',
        'Program 1',
        programIdList[0],
        'subProgram 1',
        'group 1',
        'Gilles FORMATEUR',
        '01/05/2021',
        '01/05/2021',
        'Aline CONTACT-COM',
        'Aline CONTACT-COM',
        3,
        1,
        2,
        0,
        '4,00',
        2,
        2,
        '0,00',
        2,
        2,
        '',
        '',
        1,
        3,
        1,
        2,
        0,
        0,
        '1,00',
        'Oui',
        '08/07/2024',
        '3000,00 €',
        '1 sur 2',
        'Non',
        '120,00',
        '110,00',
        '-10,00',
        '07/01/2018',
      ],
      [
        courseList[1]._id,
        'Inter B2B',
        'APA Paris',
        'Autre structure,Test SAS',
        'Société mère',
        'Program 2',
        programIdList[1],
        'subProgram 2',
        'group 2',
        'Gilles FORMATEUR, Rihanna FENTY',
        '01/02/2021',
        '',
        'Aline CONTACT-COM',
        'Aline CONTACT-COM',
        2,
        2,
        2,
        1,
        '4,00',
        1,
        0,
        '0,67',
        1,
        1,
        '01/01/2019',
        '01/01/2019',
        0,
        2,
        0,
        2,
        1,
        2,
        '0,67',
        'Non',
        '',
        '\nAutre structure: 2500,00 € (+ FF: 250,00 €)',
        '2 sur 2',
        'Oui',
        '240,00',
        '10,00',
        '-230,00',
        '07/01/2018',
      ],
      [
        courseList[2]._id,
        'Intra société mère',
        '',
        '',
        'Société mère',
        'Program 2',
        programIdList[1],
        'subProgram 2',
        'group 3',
        'Gilles FORMATEUR',
        '',
        '',
        'Aline CONTACT-COM',
        'Aline CONTACT-COM',
        0,
        0,
        0,
        0,
        '0,00',
        0,
        0,
        '0,00',
        0,
        0,
        '01/01/2022',
        '01/12/2021',
        0,
        0,
        0,
        0,
        0,
        0,
        '',
        'Non',
        '',
        '',
        '0 sur 0',
        'Non',
        '',
        '',
        '',
        '07/01/2018',
      ],
      [
        courseList[3]._id,
        'Intra',
        'Alenvi,APA Paris,Compani Test',
        'Test SAS',
        'Société mère',
        'Program 1',
        programIdList[0],
        'subProgram 1',
        'group 1',
        'Gilles FORMATEUR',
        '',
        '',
        'Aline CONTACT-COM',
        'Aline CONTACT-COM',
        3,
        0,
        0,
        0,
        '0,00',
        0,
        2,
        '0,00',
        0,
        0,
        '',
        '',
        0,
        0,
        0,
        0,
        0,
        0,
        '',
        'Non',
        '',
        '',
        '3 sur 3',
        'Oui',
        '560,00',
        '120,00',
        '-440,00',
        '07/01/2018',
      ],
      [
        courseList[4]._id,
        'Inter B2B',
        'APA Paris',
        'Autre structure',
        '',
        'Program 1',
        programIdList[0],
        'subProgram 1',
        'group 1',
        'Gilles FORMATEUR',
        '09/02/2021',
        '09/02/2021',
        'Aline CONTACT-COM',
        'Aline CONTACT-COM',
        2,
        1,
        1,
        0,
        '2,00',
        0,
        2,
        '0,00',
        0,
        0,
        '',
        '',
        0,
        1,
        0,
        1,
        0,
        0,
        '1,00',
        'Non',
        '',
        '',
        '1 sur 2',
        'Non',
        '120,00',
        '10,00',
        '-110,00',
        '07/01/2018',
      ],
      [
        courseList[5]._id,
        'Individuelle',
        'APA Paris,Compani Test',
        'Test SAS',
        'Société mère',
        'Program 1',
        programIdList[0],
        'subProgram 1',
        'Trainee 1',
        'Gilles FORMATEUR',
        '09/02/2021',
        '09/02/2021',
        'Aline CONTACT-COM',
        'Aline CONTACT-COM',
        1,
        1,
        1,
        0,
        '2,00',
        0,
        1,
        '0,00',
        0,
        0,
        '',
        '',
        0,
        1,
        0,
        0,
        0,
        0,
        '1,00',
        'Non',
        '',
        '',
        '2 sur 3',
        'Non',
        '320,00',
        '110,00',
        '-210,00',
        '07/01/2018',
      ],
    ]);
    SinonMongoose.calledOnceWithExactly(
      findCourseSlot,
      [
        {
          query: 'find',
          args: [{ startDate: { $lte: '2022-01-20T22:59:59.000Z' }, endDate: { $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        {
          query: 'find',
          args: [{
            $or: [
              { _id: { $in: courseSlotList.map(slot => slot.course) } },
              {
                estimatedStartDate: { $lte: '2022-01-20T22:59:59.000Z', $gte: '2021-01-14T23:00:00.000Z' },
                archivedAt: { $exists: false },
              },
            ],
          }],
        },
        { query: 'select', args: ['_id type misc estimatedStartDate expectedBillsCount archivedAt createdAt prices'] },
        {
          query: 'populate',
          args: [{
            path: 'companies',
            select: 'name',
            populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
          }],
        },
        { query: 'populate', args: [{ path: 'holding', select: 'name' }] },
        {
          query: 'populate',
          args: [
            {
              path: 'subProgram',
              select: 'name steps program',
              populate: [{ path: 'program', select: 'name' }, { path: 'steps', select: 'type activities' }],
            }],
        },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'operationsRepresentative', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'contact', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'slots',
            select: 'attendances startDate endDate',
            populate: {
              path: 'attendances',
              options: {
                isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                  .includes(get(credentials, 'role.vendor.name')),
              },
            },
          }],
        },
        { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'firstMobileConnectionDate' }] },
        {
          query: 'populate',
          args: [{
            path: 'bills',
            select: 'payer billedAt mainFee billingPurchaseList',
            options: { isVendorUser: has(credentials, 'role.vendor') },
            populate: [
              { path: 'payer.fundingOrganisation', select: 'name' },
              { path: 'payer.company', select: 'name' },
              { path: 'courseCreditNote', options: { isVendorUser: !!get(credentials, 'role.vendor') }, select: '_id' },
              {
                path: 'coursePayments',
                select: 'netInclTaxes nature status',
                options: { isVendorUser: !!get(credentials, 'role.vendor') },
              },
            ],
          }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaireHistory,
      [
        { query: 'find', args: [{ course: { $in: courseIdList } }] },
        { query: 'select', args: ['course questionnaire'] },
        { query: 'populate', args: [{ path: 'questionnaire', select: 'type' }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourseSmsHistory,
      [
        { query: 'find', args: [{ course: { $in: courseIdList } }] },
        { query: 'select', args: ['course'] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findAttendanceSheet,
      [
        { query: 'find', args: [{ course: { $in: courseIdList } }] },
        { query: 'select', args: ['course'] },
        {
          query: 'setOptions',
          args: [{
            isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
              .includes(get(credentials, 'role.vendor.name')),
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      findCourseHistory,
      {
        course: { $in: courseIdList },
        action: ESTIMATED_START_DATE_EDITION,
        update: { estimatedStartDate: { from: '' } },
      },
      { course: 1, update: 1 }
    );
    sinon.assert.calledWithExactly(
      findActivityHistory,
      { $and: [{ activity: { $in: [] }, user: { $in: [traineeList[0]._id, traineeList[1]._id, traineeList[2]._id] } }] }
    );
    sinon.assert.calledWithExactly(
      findActivityHistory,
      { $and: [{ activity: { $in: activityListIds }, user: { $in: [traineeList[3]._id, traineeList[4]._id] } }] }
    );
    sinon.assert.calledWithExactly(
      findActivityHistory,
      { $and: [{ activity: { $in: activityListIds }, user: { $in: [] } }] }
    );
    sinon.assert.calledWithExactly(
      findActivityHistory,
      { $and: [{ activity: { $in: [] }, user: { $in: [traineeList[0]._id, traineeList[1]._id, traineeList[2]._id] } }] }
    );
    sinon.assert.calledWithExactly(
      findActivityHistory,
      { $and: [{ activity: { $in: [] }, user: { $in: [traineeList[0]._id, traineeList[1]._id] } }] }
    );
    sinon.assert.calledWithExactly(formatPrice.getCall(0), 3000);
    sinon.assert.calledWithExactly(formatPrice.getCall(1), 2500);
    sinon.assert.calledWithExactly(formatPrice.getCall(2), 250);
  });
});

describe('exportCourseSlotHistory', () => {
  const courseIdList = [new ObjectId(), new ObjectId(), new ObjectId()];
  const credentials = { role: { vendor: { name: TRAINING_ORGANISATION_MANAGER } } };
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  const traineeList = [
    { _id: new ObjectId(), identity: { firstname: 'Paul', lastname: 'Seul' } },
    { _id: new ObjectId(), identity: { firstname: 'Taylor', lastname: 'Swift' } },
    { _id: new ObjectId(), identity: { firstname: 'Austin', lastname: 'Butler' } },
    { _id: new ObjectId(), identity: { firstname: 'Emma', lastname: 'Stone' } },
    { _id: new ObjectId(), identity: { firstname: 'Cole', lastname: 'Palmer' } },
  ];

  const courseList = [
    {
      _id: courseIdList[0],
      trainees: [traineeList[0], traineeList[1], traineeList[2]],
      type: INTRA,
      companies: [{ _id: new ObjectId(), name: 'Enbonne Company' }],
      subProgram: { _id: new ObjectId(), program: { _id: new ObjectId(), name: 'Program 1' } },
      misc: 'group 1',
    },
    {
      _id: courseIdList[1],
      trainees: [traineeList[3], traineeList[4]],
      type: INTER_B2B,
      subProgram: { _id: new ObjectId(), program: { _id: new ObjectId(), name: 'Program 2' } },
      companies: [],
      misc: 'group 2',
    },
    {
      _id: courseIdList[2],
      trainees: [traineeList[3]],
      type: SINGLE,
      subProgram: { _id: new ObjectId(), program: { _id: new ObjectId(), name: 'Program 3' } },
      companies: [],
      misc: 'Archie Pelle',
    },
  ];

  const stepList = [
    { _id: new ObjectId(), name: 'étape 1', type: ON_SITE },
    { _id: new ObjectId(), name: 'étape 2', type: REMOTE },
    { _id: new ObjectId(), name: 'étape 3', type: E_LEARNING },
  ];

  const slotAddress = {
    street: '24 Avenue Daumesnil',
    fullAddress: '24 Avenue Daumesnil 75012 Paris',
    zipCode: '75012',
    city: 'Paris',
    location: { type: 'Point', coordinates: [2.37345, 48.848024] },
  };

  const courseSlotList = [
    {
      _id: new ObjectId(),
      course: courseList[0],
      startDate: '2021-05-01T08:00:00.000Z',
      endDate: '2021-05-01T10:00:00.000Z',
      createdAt: '2020-12-12T10:00:00.000Z',
      step: stepList[0],
      address: slotAddress,
      attendances: [{ trainee: traineeList[0]._id, status: PRESENT }, { trainee: traineeList[1]._id, status: MISSING }],
    },
    {
      _id: new ObjectId(),
      course: courseList[0],
      startDate: '2021-05-01T14:00:00.000Z',
      endDate: '2021-05-01T16:00:00.000Z',
      createdAt: '2020-12-12T10:00:01.000Z',
      step: stepList[1],
      meetingLink: 'https://meet.google.com',
      attendances: [{ trainee: traineeList[0]._id, status: PRESENT }, { trainee: traineeList[1]._id, status: PRESENT }],
    },
    {
      _id: new ObjectId(),
      course: courseList[1],
      startDate: '2021-02-01T08:00:00.000Z',
      endDate: '2021-02-01T10:00:00.000Z',
      createdAt: '2020-12-12T10:00:02.000Z',
      step: stepList[0],
      address: slotAddress,
      attendances: [{ trainee: traineeList[1]._id, status: PRESENT }, { trainee: traineeList[3]._id, status: PRESENT }],
    },
    {
      _id: new ObjectId(),
      course: courseList[1],
      startDate: '2021-02-02T08:00:00.000Z',
      endDate: '2021-02-02T10:00:00.000Z',
      createdAt: '2020-12-12T10:00:03.000Z',
      step: stepList[2],
      attendances: [{ trainee: traineeList[1]._id, status: PRESENT }, { trainee: traineeList[3]._id, status: PRESENT }],
    },
    {
      _id: new ObjectId(),
      course: courseList[2],
      startDate: '2022-02-02T08:00:00.000Z',
      endDate: '2022-02-02T10:00:00.000Z',
      createdAt: '2020-12-12T10:00:03.000Z',
      step: stepList[0],
      attendances: [{ trainee: traineeList[3]._id, status: PRESENT }],
    },
  ];

  let findCourseSlot;

  beforeEach(() => {
    findCourseSlot = sinon.stub(CourseSlot, 'find');
  });

  afterEach(() => {
    findCourseSlot.restore();
  });

  it('should return an empty array if no course slots', async () => {
    findCourseSlot.returns(SinonMongoose.stubChainedQueries([]));

    const result = await ExportHelper
      .exportCourseSlotHistory('2021-01-14T23:00:00.000Z', '2022-01-20T22:59:59.000Z', credentials);

    expect(result).toEqual([[NO_DATA]]);
    SinonMongoose.calledOnceWithExactly(
      findCourseSlot,
      [
        {
          query: 'find',
          args: [{ startDate: { $lte: '2022-01-20T22:59:59.000Z' }, endDate: { $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        { query: 'populate', args: [{ path: 'step', select: 'type name' }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'type trainees misc subProgram companies',
            populate: [
              { path: 'companies', select: 'name' },
              { path: 'trainees', select: 'identity' },
              { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'attendances', options: { isVendorUser } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array with the header and 4 rows', async () => {
    findCourseSlot.returns(SinonMongoose.stubChainedQueries(courseSlotList));

    const result = await ExportHelper
      .exportCourseSlotHistory('2021-01-14T23:00:00.000Z', '2022-01-20T22:59:59.000Z', credentials);

    expect(result).toEqual([
      [
        'Id Créneau',
        'Id Formation',
        'Formation',
        'Étape',
        'Type',
        'Apprenant',
        'Date de création',
        'Date de début',
        'Date de fin',
        'Durée',
        'Adresse',
        'Nombre de présences',
        'Nombre d\'absences',
        'Nombre de présences non prévues',
        'Nombre d\'émargements non remplis',
      ],
      [
        courseSlotList[0]._id,
        courseIdList[0],
        'Enbonne Company - Program 1 - group 1',
        'étape 1',
        'présentiel',
        '',
        '12/12/2020 11:00:00',
        '01/05/2021 10:00:00',
        '01/05/2021 12:00:00',
        '2,00',
        '24 Avenue Daumesnil 75012 Paris',
        1,
        1,
        0,
        1,
      ],
      [
        courseSlotList[1]._id,
        courseIdList[0],
        'Enbonne Company - Program 1 - group 1',
        'étape 2',
        'distanciel',
        '',
        '12/12/2020 11:00:01',
        '01/05/2021 16:00:00',
        '01/05/2021 18:00:00',
        '2,00',
        'https://meet.google.com',
        2,
        0,
        0,
        1,
      ],
      [
        courseSlotList[2]._id,
        courseIdList[1],
        'Program 2 - group 2',
        'étape 1',
        'présentiel',
        '',
        '12/12/2020 11:00:02',
        '01/02/2021 09:00:00',
        '01/02/2021 11:00:00',
        '2,00',
        '24 Avenue Daumesnil 75012 Paris',
        1,
        0,
        1,
        1,
      ],
      [
        courseSlotList[3]._id,
        courseIdList[1],
        'Program 2 - group 2',
        'étape 3',
        'eLearning',
        '',
        '12/12/2020 11:00:03',
        '02/02/2021 09:00:00',
        '02/02/2021 11:00:00',
        '2,00',
        '',
        1,
        0,
        1,
        1,
      ],
      [
        courseSlotList[4]._id,
        courseIdList[2],
        'Program 3 - Archie Pelle',
        'étape 1',
        'présentiel',
        'Emma STONE',
        '12/12/2020 11:00:03',
        '02/02/2022 09:00:00',
        '02/02/2022 11:00:00',
        '2,00',
        '',
        1,
        0,
        0,
        0,
      ],
    ]);
    SinonMongoose.calledOnceWithExactly(
      findCourseSlot,
      [
        {
          query: 'find',
          args: [{ startDate: { $lte: '2022-01-20T22:59:59.000Z' }, endDate: { $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        { query: 'populate', args: [{ path: 'step', select: 'type name' }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'type trainees misc subProgram companies',
            populate: [
              { path: 'companies', select: 'name' },
              { path: 'trainees', select: 'identity' },
              { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'attendances', options: { isVendorUser } }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportEndOfCourseQuestionnaireHistory', () => {
  const credentials = { role: { vendor: { name: TRAINING_ORGANISATION_MANAGER } } };
  const cards = [
    { _id: new ObjectId(), template: 'transition' },
    { _id: new ObjectId(), question: 'Ca va ?', template: 'open_question' },
    { _id: new ObjectId(), question: 'La famille ?', template: 'survey' },
    {
      _id: new ObjectId(),
      question: 'Les ami.es ?',
      template: 'question_answer',
      qcAnswers: [
        { _id: new ObjectId(), text: 'Oui' },
        { _id: new ObjectId(), text: 'Peut être' },
        { _id: new ObjectId(), text: 'Non' },
      ],
    },
  ];
  const questionnaire = {
    type: 'end_of_course',
    cards,
    histories: [
      { // 0 all questions answered
        _id: new ObjectId(),
        course: {
          _id: new ObjectId(),
          subProgram: { name: 'Je suis Présentiel', program: { name: 'Programme files' } },
          trainers: [{ identity: { firstname: 'Didier', lastname: 'Deschamps' } }],
        },
        user: {
          _id: new ObjectId(),
          identity: { firstname: '', lastname: 'Zizou' },
          local: { email: 'zizou@2027.com' },
          contact: { countryCode: '+33', phone: '0600000000' },
        },
        company: { name: 'créole' },
        questionnaire: {
          _id: new ObjectId(),
          type: 'end_of_course',
          cards,
        },
        questionnaireAnswersList: [
          { card: { _id: cards[1]._id }, answerList: ['Ouai oklm'] },
          { card: { _id: cards[2]._id }, answerList: ['5'] },
          {
            card: { _id: cards[3]._id, qcAnswers: cards[3].qcAnswers },
            answerList: [cards[3].qcAnswers[0]._id.toHexString(), cards[3].qcAnswers[1]._id.toHexString()],
          },
        ],
        origin: WEBAPP,
        createdAt: '2021-06-27T12:40:29.561Z',
        updatedAt: '2022-03-03T12:40:29.561Z',
      },
      { // 1 not all questions answered
        _id: new ObjectId(),
        course: {
          _id: new ObjectId(),
          subProgram: { name: 'JUST', program: { name: 'DO IT !' } },
          trainers: [
            { identity: { firstname: 'Shia', lastname: 'labeouf' } },
            { identity: { firstname: 'Rihanna', lastname: 'Fenty' } },
          ],
        },
        user: {
          _id: new ObjectId(),
          identity: { firstname: 'Bob', lastname: 'Marley' },
          local: { email: 'bob@marley.com' },
          contact: {},
        },
        company: { name: 'Reggae Music' },
        questionnaire: {
          _id: new ObjectId(),
          type: 'end_of_course',
          cards,
        },
        questionnaireAnswersList: [
          {
            card: { _id: cards[3]._id, qcAnswers: cards[3].qcAnswers },
            answerList: [cards[3].qcAnswers[2]._id.toHexString()],
          },
          { card: { _id: cards[2]._id }, answerList: ['1'] },
        ],
        origin: MOBILE,
        createdAt: '2021-06-30T12:40:29.561Z',
        updatedAt: '2022-03-03T12:40:29.561Z',
      },
      { // 2 course is deleted
        _id: new ObjectId(),
        course: null,
        user: {
          _id: new ObjectId(),
          identity: { firstname: 'Bob', lastname: 'Marley' },
          local: { email: 'bob@marley.com' },
          contact: {},
        },
        company: { name: 'Reggae Music' },
        questionnaire: {
          _id: new ObjectId(),
          type: 'end_of_course',
          cards,
        },
        questionnaireAnswersList: [
          {
            card: { _id: cards[3]._id, qcAnswers: cards[3].qcAnswers },
            answerList: [cards[3].qcAnswers[2]._id.toHexString()],
          },
          { card: { _id: cards[2]._id }, answerList: ['1'] },
        ],
        origin: MOBILE,
        createdAt: '2021-06-30T12:40:29.561Z',
        updatedAt: '2022-03-03T12:40:29.561Z',
      },
    ],
  };
  let findOneQuestionnaire;

  beforeEach(() => {
    findOneQuestionnaire = sinon.stub(Questionnaire, 'findOne');
  });

  afterEach(() => {
    findOneQuestionnaire.restore();
  });

  it('should return an empty array if no questionnaire history', async () => {
    findOneQuestionnaire.returns(SinonMongoose.stubChainedQueries({ cards, histories: [] }));
    const exportArray = await ExportHelper.exportEndOfCourseQuestionnaireHistory(
      '2021-06-25T12:00:00.000Z',
      '2021-06-30:12:00.000Z',
      credentials
    );

    expect(exportArray).toEqual([['Aucune donnée sur la période sélectionnée']]);
  });

  it('should return an array with the header and 2 rows', async () => {
    findOneQuestionnaire.returns(SinonMongoose.stubChainedQueries(questionnaire));

    const exportArray = await ExportHelper.exportEndOfCourseQuestionnaireHistory(
      '2021-06-25T12:00:00.000Z',
      '2021-06-30:12:00.000Z',
      credentials
    );

    expect(exportArray).toEqual([
      [
        'Id formation',
        'Programme',
        'Sous-programme',
        'Prénom Nom intervenant·e',
        'Structure',
        'Date de réponse',
        'Origine de réponse',
        'Prénom Nom répondant(e)',
        'Mail répondant(e)',
        'Numéro de tél répondant(e)',
        'Ca va ?',
        'La famille ?',
        'Les ami.es ?',
      ],
      [
        questionnaire.histories[0].course._id,
        'Programme files',
        'Je suis Présentiel',
        'Didier DESCHAMPS',
        'créole',
        '27/06/2021 14:40:29',
        WEBAPP,
        'ZIZOU',
        'zizou@2027.com',
        '+33 6 00 00 00 00',
        'Ouai oklm',
        '5',
        'Oui,Peut être',
      ],
      [
        questionnaire.histories[1].course._id,
        'DO IT !',
        'JUST',
        'Shia LABEOUF, Rihanna FENTY',
        'Reggae Music',
        '30/06/2021 14:40:29',
        MOBILE,
        'Bob MARLEY',
        'bob@marley.com',
        '',
        '', // no answer here
        '1',
        'Non',
      ],
      [
        '',
        '',
        '',
        '',
        'Reggae Music',
        '30/06/2021 14:40:29',
        MOBILE,
        'Bob MARLEY',
        'bob@marley.com',
        '',
        '', // no answer here
        '1',
        'Non',
      ],
    ]);
    SinonMongoose.calledOnceWithExactly(
      findOneQuestionnaire,
      [
        {
          query: 'findOne',
          args: [{ type: 'end_of_course' }],
        },
        { query: 'populate', args: [{ path: 'cards', select: 'question template' }] },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            options: { isVendorUser: true },
            match: { createdAt: { $gte: '2021-06-25T12:00:00.000Z', $lte: '2021-06-30:12:00.000Z' } },
            populate: [
              {
                path: 'course',
                select: 'subProgram',
                populate: [
                  { path: 'subProgram', select: 'name program', populate: { path: 'program', select: 'name' } },
                  { path: 'trainers', select: 'identity' },
                ],
              },
              { path: 'user', select: 'identity local.email contact' },
              { path: 'company', select: 'name' },
              { path: 'questionnaireAnswersList.card', select: 'qcAnswers' },
            ],
          }],
        },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('exportCourseBillAndCreditNoteHistory', () => {
  const subProgram = { _id: new ObjectId(), program: { name: 'Program 1' } };
  const companies = [{ _id: new ObjectId(), name: 'Test SAS' }];
  const courseList = [
    {
      _id: new ObjectId(),
      subProgram,
      misc: 'Archie Pelle',
      slots: [{ startDate: '2021-01-13T12:00:00.000Z' }, { startDate: '2021-03-13T12:00:00.000Z' }],
      slotsToPlan: [],
      type: SINGLE,
      trainees: [{ _id: new ObjectId(), identity: { firstname: 'Austin', lastname: 'Butler' } }],
    },
    {
      _id: new ObjectId(),
      subProgram,
      misc: 'group 2',
      slots: [],
      slotsToPlan: [],
      type: INTER_B2B,
      trainees: [
        { _id: new ObjectId(), identity: { firstname: 'Austin', lastname: 'Butler' } },
        { _id: new ObjectId(), identity: { firstname: 'Emma', lastname: 'Stone' } },
      ],
    },
    {
      _id: new ObjectId(),
      subProgram,
      misc: 'group 3',
      slots: [
        { startDate: '2021-02-10T12:00:00.000Z' },
      ],
      slotsToPlan: [],
      type: INTRA,
      trainees: [
        { _id: new ObjectId(), identity: { firstname: 'Austin', lastname: 'Butler' } },
        { _id: new ObjectId(), identity: { firstname: 'Emma', lastname: 'Stone' } },
      ],
    },
    {
      _id: new ObjectId(),
      subProgram,
      misc: 'group 4',
      slots: [
        { startDate: '2021-01-12T16:00:00.000Z' },
        { startDate: '2021-01-12T12:00:00.000Z' },
        { startDate: '2021-01-13T12:00:00.000Z' },
        { startDate: '2021-01-14T12:00:00.000Z' },
        { startDate: '2021-01-11T12:00:00.000Z' },
        { startDate: '2021-01-15T12:00:00.000Z' },
      ],
      slotsToPlan: [{ _id: new ObjectId() }],
      type: INTRA,
      trainees: [
        { _id: new ObjectId(), identity: { firstname: 'Austin', lastname: 'Butler' } },
        { _id: new ObjectId(), identity: { firstname: 'Emma', lastname: 'Stone' } },
      ],
    },
  ];
  const payerList = [
    { _id: new ObjectId(), name: 'APA Paris' },
    { _id: new ObjectId(), name: 'ABCD' },
    { _id: new ObjectId(), name: 'ZXCV' },
  ];
  const courseBillList = [
    {
      course: courseList[0],
      mainFee: { price: 120, count: 1 },
      companies,
      payer: payerList[0],
      billedAt: '2022-03-08T00:00:00.000Z',
      number: 'FACT-00001',
      courseCreditNote: { number: 'AV-00001', date: '2022-03-09T00:00:00.000Z' },
      coursePayments: [{ netInclTaxes: 10, nature: PAYMENT, status: RECEIVED }],
      sendingDates: ['2022-06-10T00:00:00.000Z'],
    },
    {
      course: courseList[1],
      mainFee: { price: 120, count: 1 },
      companies,
      payer: payerList[0],
      billedAt: '2022-03-08T00:00:00.000Z',
      number: 'FACT-00002',
      courseCreditNote: null,
      coursePayments: [{ netInclTaxes: 110, nature: PAYMENT, status: RECEIVED }],
      sendingDates: ['2022-06-10T00:00:00.000Z', '2022-07-10T00:00:00.000Z'],
    },
    {
      course: courseList[2],
      mainFee: { price: 30, count: 1 },
      companies,
      payer: payerList[1],
      billedAt: '2022-03-10T00:00:00.000Z',
      number: 'FACT-00003',
      courseCreditNote: null,
      coursePayments: [{ netInclTaxes: 32, nature: PAYMENT, status: RECEIVED }],
      sendingDates: ['2022-06-10T00:00:00.000Z'],
    },
    {
      course: courseList[3],
      mainFee: { price: 35, count: 1 },
      companies,
      payer: payerList[2],
      billedAt: '2022-01-10T00:00:00.000Z',
      number: 'FACT-00004',
      courseCreditNote: null,
      coursePayments: [{ netInclTaxes: 35, nature: PAYMENT, status: PENDING }],
    },
  ];
  const courseCreditNoteList = [
    {
      number: 'AV-00001',
      date: '2022-03-09T00:00:00.000Z',
      courseBill: {
        companies,
        course: courseList[0],
        mainFee: { price: 120, count: 1 },
        payer: payerList[0],
        billedAt: '2022-03-08T00:00:00.000Z',
        number: 'FACT-00001',
        coursePayments: [{ netInclTaxes: 10, nature: PAYMENT }],
      },
    },
  ];
  const credentials = { company: { _id: new ObjectId() }, role: { vendor: { name: TRAINING_ORGANISATION_MANAGER } } };
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  let findCourseBill;
  let findCourseCreditNote;

  beforeEach(() => {
    findCourseBill = sinon.stub(CourseBill, 'find');
    findCourseCreditNote = sinon.stub(CourseCreditNote, 'find');
  });

  afterEach(() => {
    findCourseBill.restore();
    findCourseCreditNote.restore();
  });

  it('should return an empty array if no course', async () => {
    findCourseBill.returns(SinonMongoose.stubChainedQueries([], ['populate', 'setOptions', 'lean']));
    findCourseCreditNote.returns(SinonMongoose.stubChainedQueries([], ['populate', 'setOptions', 'lean']));

    const result = await ExportHelper.exportCourseBillAndCreditNoteHistory('2021-01-14T23:00:00.000Z', '2022-01-20T22:59:59.000Z', credentials);

    expect(result).toEqual([[NO_DATA]]);
    SinonMongoose.calledOnceWithExactly(
      findCourseBill,
      [
        {
          query: 'find',
          args: [{ billedAt: { $lte: '2022-01-20T22:59:59.000Z', $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'subProgram misc type trainees',
            populate: [
              { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              { path: 'slots', select: 'startDate' },
              { path: 'slotsToPlan', select: '_id' },
              { path: 'trainees', select: 'identity' },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.company', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.fundingOrganisation', select: 'name' }] },
        { query: 'populate', args: [{ path: 'courseCreditNote', select: 'number', options: { isVendorUser } }] },
        {
          query: 'populate',
          args: [{ path: 'coursePayments', options: { isVendorUser }, select: 'netInclTaxes nature status' }],
        },
        { query: 'setOptions', args: [{ isVendorUser }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourseCreditNote,
      [
        {
          query: 'find',
          args: [{ date: { $lte: '2022-01-20T22:59:59.000Z', $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        {
          query: 'populate',
          args: [{
            path: 'courseBill',
            populate: [
              { path: 'companies', select: 'name' },
              { path: 'payer.company', select: 'name' },
              { path: 'payer.fundingOrganisation', select: 'name' },
              { path: 'coursePayments', select: 'netInclTaxes nature', options: { isVendorUser } },
              {
                path: 'course',
                select: 'subProgram misc type trainees',
                populate: [
                  { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
                  { path: 'trainees', select: 'identity' },
                ],
              },
            ],
          }],
        },
        { query: 'setOptions', args: [{ isVendorUser }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array with the header and 3 rows', async () => {
    findCourseBill.returns(SinonMongoose.stubChainedQueries(courseBillList, ['populate', 'setOptions', 'lean']));
    findCourseCreditNote.returns(SinonMongoose.stubChainedQueries(courseCreditNoteList, ['populate', 'setOptions', 'lean']));

    const result = await ExportHelper
      .exportCourseBillAndCreditNoteHistory('2021-01-14T23:00:00.000Z', '2022-01-20T22:59:59.000Z', credentials);

    expect(result).toEqual([
      [
        'Nature',
        'Identifiant',
        'Date',
        'Id formation',
        'Formation',
        'Programme',
        'Apprenant',
        'Structure',
        'Id payeur',
        'Payeur',
        'Montant TTC',
        'Montant réglé',
        'Document lié',
        'Montant soldé',
        'Solde',
        'Envoyé le',
        'Avancement',
        'Début de la formation',
        'Milieu de la formation',
        'Fin de la formation',
      ],
      [
        'Facture',
        'FACT-00001',
        '08/03/2022',
        courseList[0]._id,
        'Program 1 - Archie Pelle',
        'Program 1',
        'Austin BUTLER',
        'Test SAS',
        payerList[0]._id,
        'APA Paris',
        '120,00',
        '10,00',
        'AV-00001',
        '120,00',
        '10,00',
        '10/06/2022',
        '1,00',
        '13/01/2021',
        '13/01/2021',
        '13/03/2021',
      ],
      [
        'Facture',
        'FACT-00002',
        '08/03/2022',
        courseList[1]._id,
        'Program 1 - group 2',
        'Program 1',
        '',
        'Test SAS',
        payerList[0]._id,
        'APA Paris',
        '120,00',
        '110,00',
        '',
        '',
        '-10,00',
        '10/06/2022, 10/07/2022',
        '',
        '',
        '',
        '',
      ],
      [
        'Facture',
        'FACT-00003',
        '10/03/2022',
        courseList[2]._id,
        'Test SAS - Program 1 - group 3',
        'Program 1',
        '',
        'Test SAS',
        payerList[1]._id,
        'ABCD',
        '30,00',
        '32,00',
        '',
        '',
        '2,00',
        '10/06/2022',
        '1,00',
        '10/02/2021',
        '10/02/2021',
        '10/02/2021',
      ],
      [
        'Facture',
        'FACT-00004',
        '10/01/2022',
        courseList[3]._id,
        'Test SAS - Program 1 - group 4',
        'Program 1',
        '',
        'Test SAS',
        payerList[2]._id,
        'ZXCV',
        '35,00',
        '0,00',
        '',
        '',
        '-35,00',
        '',
        '0,86',
        '11/01/2021',
        '13/01/2021',
        '',
      ],
      [
        'Avoir',
        'AV-00001',
        '09/03/2022',
        courseList[0]._id,
        'Program 1 - Archie Pelle',
        'Program 1',
        'Austin BUTLER',
        'Test SAS',
        payerList[0]._id,
        'APA Paris',
        '120,00',
        '',
        'FACT-00001',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    ]);
    SinonMongoose.calledOnceWithExactly(
      findCourseBill,
      [
        {
          query: 'find',
          args: [{ billedAt: { $lte: '2022-01-20T22:59:59.000Z', $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'subProgram misc type trainees',
            populate: [
              { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              { path: 'slots', select: 'startDate' },
              { path: 'slotsToPlan', select: '_id' },
              { path: 'trainees', select: 'identity' },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.company', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.fundingOrganisation', select: 'name' }] },
        { query: 'populate', args: [{ path: 'courseCreditNote', select: 'number', options: { isVendorUser } }] },
        {
          query: 'populate',
          args: [{ path: 'coursePayments', options: { isVendorUser }, select: 'netInclTaxes nature status' }],
        },
        { query: 'setOptions', args: [{ isVendorUser }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourseCreditNote,
      [
        {
          query: 'find',
          args: [{ date: { $lte: '2022-01-20T22:59:59.000Z', $gte: '2021-01-14T23:00:00.000Z' } }],
        },
        {
          query: 'populate',
          args: [{
            path: 'courseBill',
            populate: [
              { path: 'companies', select: 'name' },
              { path: 'payer.company', select: 'name' },
              { path: 'payer.fundingOrganisation', select: 'name' },
              { path: 'coursePayments', select: 'netInclTaxes nature', options: { isVendorUser } },
              {
                path: 'course',
                select: 'subProgram misc type trainees',
                populate: [
                  { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
                  { path: 'trainees', select: 'identity' },
                ],
              },
            ],
          }],
        },
        { query: 'setOptions', args: [{ isVendorUser }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportCoursePaymentHistory', () => {
  let findCoursePayment;
  const credentials = { role: { vendor: { name: 'training_organisation_manager' } } };

  beforeEach(() => {
    findCoursePayment = sinon.stub(CoursePayment, 'find');
  });

  afterEach(() => {
    findCoursePayment.restore();
  });

  it('should return an empty array if no course', async () => {
    findCoursePayment.returns(SinonMongoose.stubChainedQueries([], ['setOptions', 'lean']));

    const result = await ExportHelper.exportCoursePaymentHistory('2021-01-14T23:00:00.000Z', '2022-01-20T22:59:59.000Z', credentials);

    expect(result).toEqual([[NO_DATA]]);

    SinonMongoose.calledOnceWithExactly(
      findCoursePayment,
      [
        { query: 'find', args: [{ date: { $lte: '2022-01-20T22:59:59.000Z', $gte: '2021-01-14T23:00:00.000Z' } }, { courseBill: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array with the header and 3 rows', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const payerId = new ObjectId();
    const coursePaymentList = [
      {
        _id: new ObjectId(),
        nature: REFUND,
        number: 'REG-2',
        date: '2022-01-22T23:00:00.000Z',
        courseBill: {
          _id: courseBillIds[0],
          number: 'FACT-2',
          payer: { _id: payerId },
          course: { type: SINGLE, trainees: [{ _id: new ObjectId(), identity: { firstname: 'Archie', lastname: 'Pelle' } }] },
        },
        type: CHECK,
        netInclTaxes: 22,
        status: RECEIVED,
      },
      {
        _id: new ObjectId(),
        nature: PAYMENT,
        number: 'REG-1',
        date: '2022-01-01T23:00:00.000Z',
        courseBill: {
          _id: courseBillIds[0],
          number: 'FACT-2',
          payer: { _id: payerId },
          course: { type: SINGLE, trainees: [{ _id: new ObjectId(), identity: { firstname: 'Archie', lastname: 'Pelle' } }] },
        },
        type: CHECK,
        netInclTaxes: 100,
        status: RECEIVED,
      },
      {
        _id: new ObjectId(),
        nature: REFUND,
        number: 'REG-4',
        date: '2022-01-10T23:00:00.000Z',
        courseBill: {
          _id: courseBillIds[1],
          number: 'FACT-1',
          payer: { _id: payerId },
          course: { type: INTRA, trainees: [{ _id: new ObjectId(), identity: { firstname: 'Archie', lastname: 'Pelle' } }] },
        },
        type: CHECK,
        netInclTaxes: 200,
        status: RECEIVED,
      },
    ];
    findCoursePayment
      .onCall(0)
      .returns(
        SinonMongoose.stubChainedQueries(
          [
            { _id: coursePaymentList[0], courseBill: courseBillIds[0] },
            { _id: coursePaymentList[2], courseBill: courseBillIds[1] },
          ],
          ['setOptions', 'lean'])
      );
    findCoursePayment.onCall(1).returns(SinonMongoose.stubChainedQueries(coursePaymentList, ['populate', 'setOptions', 'lean']));

    const result = await ExportHelper.exportCoursePaymentHistory('2022-01-07T23:00:00.000Z', '2022-01-30T22:59:59.000Z', credentials);

    expect(result).toEqual([
      ['Nature', 'Identifiant', 'Date', 'Facture associée', 'Id payeur facture', 'Numéro du paiement (parmi ceux de la même facture)', 'Moyen de paiement', 'Montant', 'Statut', 'Nom de lot fichier XML', 'Apprenant'],
      ['Remboursement', 'REG-2', '23/01/2022', 'FACT-2', payerId, 2, 'Chèque', '22,00', 'Reçu', '', 'Archie PELLE'],
      ['Remboursement', 'REG-4', '11/01/2022', 'FACT-1', payerId, 1, 'Chèque', '200,00', 'Reçu', '', ''],
    ]);
    SinonMongoose.calledWithExactly(
      findCoursePayment,
      [
        { query: 'find', args: [{ date: { $lte: '2022-01-30T22:59:59.000Z', $gte: '2022-01-07T23:00:00.000Z' } }, { courseBill: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ],
      0
    );
    SinonMongoose.calledWithExactly(
      findCoursePayment,
      [
        {
          query: 'find',
          args: [
            { courseBill: { $in: courseBillIds } },
            { nature: 1, number: 1, date: 1, courseBill: 1, type: 1, netInclTaxes: 1, status: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'courseBill',
            option: { isVendorUser: true },
            select: 'number payer course',
            populate: { path: 'course', select: 'type trainees', populate: { path: 'trainees', select: 'identity' } },
          }],
        },
        { query: 'populate', args: [{ path: 'xmlSEPAFileInfos', select: 'name', options: { isVendorUser: true } }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ],
      1
    );
  });
});

describe('exportSelfPositionningQuestionnaireHistory', () => {
  let findCourseSlot;
  let findCourse;
  let findQuestionnaireHistory;

  const credentials = { role: { vendor: { name: 'training_organisation_manager' } } };
  const startDate = '2021-01-01T23:00:00.000Z';
  const endDate = '2021-02-28T22:59:59.000Z';

  beforeEach(() => {
    findCourseSlot = sinon.stub(CourseSlot, 'find');
    findCourse = sinon.stub(Course, 'find');
    findQuestionnaireHistory = sinon.stub(QuestionnaireHistory, 'find');
  });

  afterEach(() => {
    findCourseSlot.restore();
    findCourse.restore();
    findQuestionnaireHistory.restore();
  });

  it('should return an empty array if no course', async () => {
    findCourseSlot.returns(SinonMongoose.stubChainedQueries([], ['lean']));
    findCourse.returns(SinonMongoose.stubChainedQueries([]));
    findQuestionnaireHistory.returns(SinonMongoose.stubChainedQueries([], ['populate', 'setOptions', 'lean']));

    const result = await ExportHelper.exportSelfPositionningQuestionnaireHistory(startDate, endDate, credentials);

    expect(result).toEqual([[NO_DATA]]);

    SinonMongoose.calledOnceWithExactly(
      findCourseSlot,
      [
        { query: 'find', args: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }, { course: 1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        { query: 'find', args: [{ _id: { $in: [] } }, { slots: 1, slotsToPlan: 1, type: 1, subProgram: 1, trainees: 1, trainers: 1, misc: 1 }] },
        { query: 'populate', args: [{ path: 'slotsToPlan' }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'subProgram', select: 'program name', populate: [{ path: 'program', select: 'name' }] }] },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaireHistory,
      [
        { query: 'find', args: [{ course: { $in: [] } }, { questionnaire: 1, course: 1, timeline: 1, questionnaireAnswersList: 1 }] },
        { query: 'populate', args: [{ path: 'questionnaire', select: 'type' }] },
        { query: 'populate', args: [{ path: 'questionnaireAnswersList.card' }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array with the header and 1 row', async () => {
    const courseSlotIdList = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
    const courseIdList = [new ObjectId(), new ObjectId(), new ObjectId()];
    const programIdList = [new ObjectId(), new ObjectId(), new ObjectId()];
    const traineeIdList = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];

    const courseList = [
      {
        _id: courseIdList[0],
        misc: 'Groupe 1',
        slots: [{ _id: courseSlotIdList[0], startDate: '2021-01-03T08:00:00.000Z', endDate: '2021-01-03T10:00:00.000Z' }, { _id: courseSlotIdList[1], startDate: '2020-02-01T10:00:00.000Z', endDate: '2021-02-01T16:00:00.000Z' }],
        slotsToPlan: [],
        subProgram: { _id: new ObjectId(), name: 'Sous-programme 1', program: { _id: new ObjectId(), name: 'Programme 1' } },
        trainers: [{ identity: { firstname: 'Albert', lastname: 'Einstein' } }],
        trainees: traineeIdList,
      },
      {
        _id: courseIdList[1],
        misc: 'Groupe 2',
        slots: [{ _id: courseSlotIdList[2], startDate: '2021-02-01T08:00:00.000Z', endDate: '2021-02-01T10:00:00.000Z' }, { _id: courseSlotIdList[3], startDate: '2021-04-02T08:00:00.000Z', endDate: '2021-04-02T10:00:00.000Z' }],
        slotsToPlan: [],
        subProgram: { _id: new ObjectId(), name: 'Sous-programme 1', program: { _id: programIdList[0], name: 'Programme 2' } },
        trainers: [],
      },
      {
        _id: courseIdList[2],
        misc: 'Groupe 3',
        slots: [{ _id: courseSlotIdList[4], startDate: '2021-04-02T08:00:00.000Z', endDate: '2021-04-02T10:00:00.000Z' }],
        slotsToPlan: [{ _id: courseSlotIdList[5] }],
        subProgram: { _id: new ObjectId(), name: 'Sous-programme 1', program: { _id: programIdList[1], name: 'Programme 3' } },
        trainers: [],
      },
    ];

    const courseSlotList = [
      { _id: courseSlotIdList[0], course: courseList[0]._id, startDate: '2021-01-03T08:00:00.000Z', endDate: '2021-05-03T10:00:00.000Z' },
      { _id: courseSlotIdList[1], course: courseList[0]._id, startDate: '2021-02-01T10:00:00.000Z', endDate: '2021-02-01T16:00:00.000Z' },
      { _id: courseSlotIdList[2], course: courseList[1]._id, startDate: '2021-02-01T08:00:00.000Z', endDate: '2021-02-01T10:00:00.000Z' },
      { _id: courseSlotIdList[3], course: courseList[1]._id, startDate: '2021-04-02T08:00:00.000Z', endDate: '2021-04-02T10:00:00.000Z' },
      { _id: courseSlotIdList[4], course: courseList[2]._id, startDate: '2021-04-02T08:00:00.000Z', endDate: '2021-04-02T10:00:00.000Z' },
    ];

    const cardIdList = [new ObjectId(), new ObjectId(), new ObjectId()];
    const labels = {
      1: 'Je me sens en difficulté',
      2: 'En difficulté mais j\'identifie des axes de progression',
      3: 'Je me sens capable',
      4: 'J\'y arrive parfois',
      5: 'Oui peu importe le contexte',
    };

    const cardList = [
      {
        _id: cardIdList[0],
        template: 'survey',
        question: 'Je me sens capable de faire la toilette d\'un résident seule',
        labels,
      },
      {
        _id: cardIdList[1],
        template: 'survey',
        question: 'Je me sens capable de proposer une animation adaptée a tous les residents',
        labels,
      },
      {
        _id: cardIdList[2],
        template: 'survey',
        question: 'Je me sens capable de cuisiner avec les residents',
        labels,
      },
    ];
    const questionnaire = { _id: new ObjectId(), name: 'auto-positionnement', program: programIdList[0], cards: cardIdList[0], type: SELF_POSITIONNING };
    const questionnaireHistories = [{
      course: courseIdList[0],
      user: traineeIdList[1],
      questionnaire,
      timeline: 'start_course',
      questionnaireAnswersList: [{ card: cardList[0], answerList: ['3'] }, { card: cardList[1], answerList: ['2'] }, { card: cardList[1], answerList: ['4'] }],
    },
    {
      course: courseIdList[0],
      user: traineeIdList[1],
      questionnaire,
      timeline: 'end_course',
      questionnaireAnswersList: [{ card: cardList[0], answerList: ['4'] }, { card: cardList[1], answerList: ['2'] }, { card: cardList[1], answerList: ['3'] }],
    },
    {
      course: courseIdList[0],
      user: traineeIdList[2],
      questionnaire,
      timeline: 'start_course',
      questionnaireAnswersList: [{ card: cardList[0], answerList: ['1'] }, { card: cardList[1], answerList: ['2'] }, { card: cardList[1], answerList: ['3'] }],
    },
    {
      course: courseIdList[0],
      user: traineeIdList[2],
      questionnaire,
      timeline: 'end_course',
      questionnaireAnswersList: [{ card: cardList[0], answerList: ['3'] }, { card: cardList[1], answerList: ['2'] }, { card: cardList[1], answerList: ['3'] }],
    }];
    findCourseSlot.returns(SinonMongoose.stubChainedQueries(courseSlotList, ['lean']));
    findCourse.returns(SinonMongoose.stubChainedQueries([courseList[0], courseList[1], courseList[2]], ['populate', 'populate', 'populate', 'lean']));
    findQuestionnaireHistory.returns(SinonMongoose.stubChainedQueries(questionnaireHistories, ['populate', 'setOptions', 'lean']));

    const result = await ExportHelper.exportSelfPositionningQuestionnaireHistory(startDate, endDate, credentials);

    expect(result).toEqual([
      [
        'Id formation',
        'Programme',
        'Infos complémentaires',
        'Sous-programme',
        'Prénom Nom intervenant',
        'Nombre d\'apprenants inscrits',
        'Nombre de réponses au questionnaire de début',
        'Moyenne de l’auto-positionnement de début',
        'Nombre de réponses au questionnaire de fin',
        'Moyenne de l’auto-positionnement de fin',
        'Delta entre la moyenne de début et de fin',
        'Question ayant la plus grande progression',
        'Progression maximale associée',
        'Question ayant la plus faible progression',
        'Progression minimale associée',
      ],
      [
        courseIdList[0],
        'Programme 1',
        'Groupe 1',
        'Sous-programme 1',
        'Albert EINSTEIN',
        6,
        2,
        '2,50',
        2,
        '2,83',
        '0,33',
        'Je me sens capable de faire la toilette d\'un résident seule',
        '1,50',
        'Je me sens capable de proposer une animation adaptée a tous les residents',
        '-0,25',
      ],
    ]);

    SinonMongoose.calledOnceWithExactly(
      findCourseSlot,
      [
        { query: 'find', args: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }, { course: 1 }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        { query: 'find', args: [{ _id: { $in: [courseList[0]._id, courseList[1]._id, courseList[2]._id] } }, { slots: 1, slotsToPlan: 1, type: 1, subProgram: 1, trainees: 1, trainers: 1, misc: 1 }] },
        { query: 'populate', args: [{ path: 'slotsToPlan' }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'subProgram', select: 'program name', populate: [{ path: 'program', select: 'name' }] }] },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaireHistory,
      [
        { query: 'find', args: [{ course: { $in: [courseIdList[0]] } }, { questionnaire: 1, course: 1, timeline: 1, questionnaireAnswersList: 1 }] },
        { query: 'populate', args: [{ path: 'questionnaire', select: 'type' }] },
        { query: 'populate', args: [{ path: 'questionnaireAnswersList.card' }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });
});
