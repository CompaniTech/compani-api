const sinon = require('sinon');
const omit = require('lodash/omit');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const os = require('os');
const { PassThrough } = require('stream');
const Boom = require('@hapi/boom');
const { get } = require('lodash');
const UtilsMock = require('../../utilsMock');
const Company = require('../../../src/models/Company');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const SubProgram = require('../../../src/models/SubProgram');
const Attendance = require('../../../src/models/Attendance');
const User = require('../../../src/models/User');
const CourseHistory = require('../../../src/models/CourseHistory');
const CourseSlot = require('../../../src/models/CourseSlot');
const CourseSmsHistory = require('../../../src/models/CourseSmsHistory');
const Drive = require('../../../src/models/Google/Drive');
const Questionnaire = require('../../../src/models/Questionnaire');
const TrainingContract = require('../../../src/models/TrainingContract');
const CourseHelper = require('../../../src/helpers/courses');
const EmailHelper = require('../../../src/helpers/email');
const SmsHelper = require('../../../src/helpers/sms');
const UtilsHelper = require('../../../src/helpers/utils');
const PdfHelper = require('../../../src/helpers/pdf');
const ZipHelper = require('../../../src/helpers/zip');
const DocxHelper = require('../../../src/helpers/docx');
const StepsHelper = require('../../../src/helpers/steps');
const TrainingContractsHelper = require('../../../src/helpers/trainingContracts');
const NotificationHelper = require('../../../src/helpers/notifications');
const VendorCompaniesHelper = require('../../../src/helpers/vendorCompanies');
const {
  COURSE_SMS,
  BLENDED,
  DRAFT,
  E_LEARNING,
  STRICTLY_E_LEARNING,
  ON_SITE,
  MOBILE,
  REMOTE,
  INTRA,
  INTER_B2B,
  OPERATIONS,
  PEDAGOGY,
  WEBAPP,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  VENDOR_ROLES,
  INTER_B2C,
  TRAINER,
  COURSE,
  TRAINEE,
  HOLDING_ADMIN,
  QUESTIONNAIRE,
  INTRA_HOLDING,
  ALL_PDF,
  ALL_WORD,
  PDF,
  CUSTOM,
  OFFICIAL,
  END_COURSE,
  SELF_POSITIONNING,
  EXPECTATIONS,
  DAY,
  SINGLE,
} = require('../../../src/helpers/constants');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');
const CourseRepository = require('../../../src/repositories/CourseRepository');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
const SinonMongoose = require('../sinonMongoose');
const InterAttendanceSheet = require('../../../src/data/pdf/attendanceSheet/interAttendanceSheet');
const IntraAttendanceSheet = require('../../../src/data/pdf/attendanceSheet/intraAttendanceSheet');
const CourseConvocation = require('../../../src/data/pdf/courseConvocation');
const CompletionCertificate = require('../../../src/data/pdf/completionCertificate');
const TrainingContractPdf = require('../../../src/data/pdf/trainingContract');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const TrainerMission = require('../../../src/models/TrainerMission');

describe('createCourse', () => {
  let create;
  let findOneSubProgram;
  let createHistoryOnEstimatedStartDateEdition;
  let insertManyCourseSlot;
  let findOneTrainee;
  const credentials = { _id: new ObjectId() };

  beforeEach(() => {
    create = sinon.stub(Course, 'create');
    findOneSubProgram = sinon.stub(SubProgram, 'findOne');
    createHistoryOnEstimatedStartDateEdition = sinon.stub(
      CourseHistoriesHelper,
      'createHistoryOnEstimatedStartDateEdition'
    );
    insertManyCourseSlot = sinon.stub(CourseSlot, 'insertMany');
    findOneTrainee = sinon.stub(User, 'findOne');
  });
  afterEach(() => {
    create.restore();
    findOneSubProgram.restore();
    createHistoryOnEstimatedStartDateEdition.restore();
    insertManyCourseSlot.restore();
    findOneTrainee.restore();
  });

  it('should create an intra course', async () => {
    const steps = [
      { _id: new ObjectId(), type: ON_SITE },
      { _id: new ObjectId(), type: REMOTE },
      { _id: new ObjectId(), type: E_LEARNING },
    ];
    const subProgram = { _id: new ObjectId(), steps };
    const payload = {
      misc: 'name',
      company: new ObjectId(),
      subProgram: subProgram._id,
      type: INTRA,
      maxTrainees: 12,
      operationsRepresentative: new ObjectId(),
    };

    findOneSubProgram.returns(SinonMongoose.stubChainedQueries(subProgram));
    create.returns({ ...omit(payload, 'company'), companies: [payload.company], format: 'blended' });

    const result = await CourseHelper.createCourse(payload, credentials);

    const slots = [{ course: result._id, step: steps[0]._id }, { course: result._id, step: steps[1]._id }];

    expect(result.misc).toEqual('name');
    expect(result.subProgram).toEqual(payload.subProgram);
    expect(result.companies).toContain(payload.company);
    expect(result.format).toEqual('blended');
    expect(result.type).toEqual(INTRA);
    expect(result.operationsRepresentative).toEqual(payload.operationsRepresentative);
    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    sinon.assert.notCalled(findOneTrainee);
    sinon.assert.calledOnceWithExactly(create, { ...omit(payload, 'company'), companies: [payload.company] });
    sinon.assert.calledOnceWithExactly(insertManyCourseSlot, slots);
    SinonMongoose.calledOnceWithExactly(
      findOneSubProgram,
      [
        { query: 'findOne', args: [{ _id: subProgram._id }, { steps: 1 }] },
        { query: 'populate', args: [{ path: 'steps', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should create a single course', async () => {
    const steps = [
      { _id: new ObjectId(), type: ON_SITE },
    ];
    const subProgram = { _id: new ObjectId(), steps };
    const trainee = { _id: new ObjectId(), company: new ObjectId() };
    const payload = {
      misc: 'name',
      subProgram: subProgram._id,
      type: SINGLE,
      operationsRepresentative: new ObjectId(),
      expectedBillsCount: '0',
      trainee: trainee._id,
    };

    findOneSubProgram.returns(SinonMongoose.stubChainedQueries(subProgram));
    create.returns({ ...payload, companies: [trainee.company], format: 'blended' });
    findOneTrainee.returns(SinonMongoose.stubChainedQueries(trainee));

    const result = await CourseHelper.createCourse(payload, credentials);

    const slots = [{ course: result._id, step: steps[0]._id }];

    expect(result.misc).toEqual('name');
    expect(result.subProgram).toEqual(payload.subProgram);
    expect(result.format).toEqual('blended');
    expect(result.type).toEqual(payload.type);
    expect(result.operationsRepresentative).toEqual(payload.operationsRepresentative);
    expect(result.expectedBillsCount).toEqual('0');
    expect(result.trainee).toEqual(payload.trainee);
    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    sinon.assert.calledOnceWithExactly(create, { ...payload, companies: [trainee.company] });
    SinonMongoose.calledOnceWithExactly(
      findOneTrainee,
      [
        { query: 'findOne', args: [{ _id: trainee._id }] },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(insertManyCourseSlot, slots);
    SinonMongoose.calledOnceWithExactly(
      findOneSubProgram,
      [
        { query: 'findOne', args: [{ _id: subProgram._id }, { steps: 1 }] },
        { query: 'populate', args: [{ path: 'steps', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should create an inter course without steps', async () => {
    const subProgram = { _id: new ObjectId(), steps: [] };
    const payload = {
      misc: 'name',
      subProgram: subProgram._id,
      type: INTER_B2B,
      operationsRepresentative: new ObjectId(),
    };

    findOneSubProgram.returns(SinonMongoose.stubChainedQueries(subProgram));
    create.returns({ ...payload, format: 'blended', companies: [] });

    const result = await CourseHelper.createCourse(payload, credentials);

    expect(result.misc).toEqual('name');
    expect(result.subProgram).toEqual(payload.subProgram);
    expect(result.format).toEqual('blended');
    expect(result.type).toEqual(INTER_B2B);
    expect(result.operationsRepresentative).toEqual(payload.operationsRepresentative);
    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    sinon.assert.calledOnceWithExactly(create, payload);
    sinon.assert.notCalled(insertManyCourseSlot);
    sinon.assert.notCalled(findOneTrainee);
    SinonMongoose.calledOnceWithExactly(
      findOneSubProgram,
      [
        { query: 'findOne', args: [{ _id: subProgram._id }, { steps: 1 }] },
        { query: 'populate', args: [{ path: 'steps', select: '_id type' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should call CourseHistoryHelper for history save when creating a course with estimatedStartDate', async () => {
    const subProgram = { _id: new ObjectId(), steps: [] };
    const payload = {
      misc: 'avec une date de début prévu',
      company: new ObjectId(),
      subProgram: subProgram._id,
      type: INTRA,
      operationsRepresentative: new ObjectId(),
      estimatedStartDate: '2022-12-10T12:00:00.000Z',
    };
    const createdCourse = { ...payload, _id: new ObjectId(), format: 'blended', companies: [] };

    findOneSubProgram.returns(SinonMongoose.stubChainedQueries(subProgram));
    create.returns(createdCourse);

    await CourseHelper.createCourse(payload, credentials);

    sinon.assert.calledOnceWithExactly(
      createHistoryOnEstimatedStartDateEdition,
      createdCourse._id,
      credentials._id,
      '2022-12-10T12:00:00.000Z'
    );
    sinon.assert.notCalled(findOneTrainee);
  });
});

describe('getTotalTheoreticalDuration', () => {
  it('should return theoreticalDuration sum', async () => {
    const course = {
      subProgram: {
        steps: [
          { _id: new ObjectId(), theoreticalDuration: 'PT504S' },
          { _id: new ObjectId() },
          { _id: new ObjectId(), theoreticalDuration: 'PT0S' },
          { _id: new ObjectId(), theoreticalDuration: 'PT3600S' },
        ],
      },
    };
    const result = await CourseHelper.getTotalTheoreticalDuration(course);
    expect(result).toBe('PT4104S');
  });

  it('should return 0 if no steps', async () => {
    const course = { subProgram: { steps: [] } };
    const result = await CourseHelper.getTotalTheoreticalDuration(course);
    expect(result).toBe('PT0S');
  });
});

describe('list', () => {
  let findCourseAndPopulate;
  let userFindOne;
  let find;
  let getTotalTheoreticalDurationSpy;
  let formatCourseWithProgress;
  let getCompanyAtCourseRegistrationList;
  const authCompany = new ObjectId();
  const credentials = {
    _id: new ObjectId(),
    role: { vendor: { name: TRAINING_ORGANISATION_MANAGER }, holding: { name: HOLDING_ADMIN } },
    holding: { _id: new ObjectId(), companies: [new ObjectId(), new ObjectId()] },
  };
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  beforeEach(() => {
    findCourseAndPopulate = sinon.stub(CourseRepository, 'findCourseAndPopulate');
    userFindOne = sinon.stub(User, 'findOne');
    find = sinon.stub(Course, 'find');
    getTotalTheoreticalDurationSpy = sinon.spy(CourseHelper, 'getTotalTheoreticalDuration');
    formatCourseWithProgress = sinon.stub(CourseHelper, 'formatCourseWithProgress');
    getCompanyAtCourseRegistrationList = sinon.stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
  });

  afterEach(() => {
    findCourseAndPopulate.restore();
    userFindOne.restore();
    find.restore();
    getTotalTheoreticalDurationSpy.restore();
    formatCourseWithProgress.restore();
    getCompanyAtCourseRegistrationList.restore();
  });

  describe('OPERATIONS', () => {
    it('should return courses', async () => {
      const trainerId = new ObjectId();
      const coursesList = [
        {
          _id: new ObjectId(),
          type: INTRA,
          misc: 'name',
          name: 'Formation',
          companies: [new ObjectId()],
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Développement personnel test',
              type: E_LEARNING,
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            }],
            slots: [
              {
                startDate: '2019-11-06T09:00:00.000Z',
                endDate: '2019-11-06T12:00:00.000Z',
                step: new ObjectId(),
                attendances: [{ _id: new ObjectId() }],
              },
            ],
          },
          trainers: [{ _id: trainerId, identity: { firstname: 'Un nouveau', lastname: 'Prof' } }],
          trainees: [],
          operationsRepresentative: { identity: { firstname: 'charge', lastname: 'operations' } },
          salesRepresentative: { identity: { firstname: 'charge', lastname: 'd\'accompagnement' } },
        },
        {
          _id: new ObjectId(),
          type: INTRA,
          name: 'Super formation',
          misc: 'program',
          companies: [new ObjectId()],
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Intégrer des nouvelles personnes dans une équipe',
              type: E_LEARNING,
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            }],
            slots: [
              {
                startDate: '2019-13-06T09:00:00.000Z',
                endDate: '2019-13-06T12:00:00.000Z',
                step: new ObjectId(),
                attendances: [{ _id: new ObjectId() }],
              },
            ],
          },
          trainers: [{ _id: trainerId, identity: { firstname: 'Un autre', lastname: 'Prof' } }],
          trainees: [],
          operationsRepresentative: { identity: { firstname: 'charge', lastname: 'operations' } },
          salesRepresentative: { identity: { firstname: 'charge', lastname: 'd\'accompagnement' } },
        },
      ];

      findCourseAndPopulate.returns(coursesList);

      const query = {
        trainers: [trainerId],
        format: 'blended',
        action: 'operations',
        origin: 'webapp',
        isArchived: false,
      };
      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject(coursesList);
      sinon.assert.calledOnceWithExactly(
        findCourseAndPopulate,
        { trainers: [trainerId], format: 'blended', archivedAt: { $exists: false } },
        'webapp'
      );
      sinon.assert.notCalled(getTotalTheoreticalDurationSpy);
      sinon.assert.notCalled(userFindOne);
      sinon.assert.notCalled(find);
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
    });

    it('should return eLearning courses', async () => {
      const coursesList = [
        {
          misc: 'name',
          subProgram: {
            steps: [
              { _id: new ObjectId(), theoreticalDuration: 'PT2880S' },
              { _id: new ObjectId(), theoreticalDuration: 'PT1080S' },
              { _id: new ObjectId() },
            ],
          },
        },
        { misc: 'program', subProgram: { steps: [] } },
      ];
      const formattedCourseList = [
        { misc: 'name', totalTheoreticalDuration: 'PT3960S' },
        { misc: 'program', totalTheoreticalDuration: 'PT0S' },
      ];

      findCourseAndPopulate.returns(coursesList);

      const query = { format: 'strictly_e_learning', action: 'operations', origin: 'webapp' };
      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject(formattedCourseList);
      sinon.assert.calledOnceWithExactly(
        findCourseAndPopulate,
        { format: 'strictly_e_learning' },
        'webapp'
      );
      sinon.assert.calledTwice(getTotalTheoreticalDurationSpy);
      sinon.assert.notCalled(userFindOne);
      sinon.assert.notCalled(find);
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
    });

    it('should return company courses', async () => {
      const courseIdList = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
      const traineeIdList = [new ObjectId(), new ObjectId()];
      const coursesList = [
        { _id: courseIdList[0], misc: 'name', type: INTRA },
        { _id: courseIdList[1], misc: 'name2', type: INTRA },
        { _id: courseIdList[2], misc: 'program', type: INTER_B2B, trainees: [traineeIdList[0]] },
        { _id: courseIdList[3], misc: 'program', type: INTRA_HOLDING, trainees: [traineeIdList[0]] },
      ];
      const returnedList = [
        { _id: courseIdList[0], misc: 'name', type: INTRA },
        { _id: courseIdList[1], misc: 'name2', type: INTRA },
        { _id: courseIdList[2], misc: 'program', type: INTER_B2B, trainees: traineeIdList },
        { _id: courseIdList[3], misc: 'program', type: INTRA_HOLDING, trainees: traineeIdList },
      ];

      findCourseAndPopulate.returns(returnedList);
      getCompanyAtCourseRegistrationList.onCall(0).returns([
        { trainee: traineeIdList[0], company: authCompany },
        { trainee: traineeIdList[1], company: new ObjectId() },
      ]);

      getCompanyAtCourseRegistrationList.onCall(1).returns([
        { trainee: traineeIdList[0], company: authCompany },
        { trainee: traineeIdList[1], company: new ObjectId() },
      ]);

      const query = {
        company: authCompany.toHexString(),
        trainers: ['1234567890abcdef12345678'],
        format: 'blended',
        action: 'operations',
        origin: 'webapp',
      };

      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject(coursesList);
      sinon.assert.calledOnceWithExactly(
        findCourseAndPopulate,
        { companies: authCompany.toHexString(), trainers: ['1234567890abcdef12345678'], format: 'blended' },
        'webapp',
        true
      );
      sinon.assert.notCalled(getTotalTheoreticalDurationSpy);
      sinon.assert.notCalled(userFindOne);
      sinon.assert.notCalled(find);
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.calledWithExactly(
        getCompanyAtCourseRegistrationList.getCall(0),
        { key: COURSE, value: courseIdList[2] },
        { key: TRAINEE, value: traineeIdList }
      );
      sinon.assert.calledWithExactly(
        getCompanyAtCourseRegistrationList.getCall(1),
        { key: COURSE, value: courseIdList[3] },
        { key: TRAINEE, value: traineeIdList }
      );
    });

    it('should return company eLearning courses', async () => {
      const companyId = new ObjectId();
      const traineeId = new ObjectId();
      const coursesList = [
        {
          accessRules: [],
          format: 'strictly_e_learning',
          trainees: [
            { _id: traineeId, company: { _id: companyId } },
            { _id: new ObjectId(), company: { _id: new ObjectId() } },
            { _id: new ObjectId() },
          ],
          subProgram: {
            steps: [
              { _id: new ObjectId(), theoreticalDuration: 'PT1440S' },
              { _id: new ObjectId(), theoreticalDuration: 'PT5040S' },
              { _id: new ObjectId() },
            ],
          },
        },
        { accessRules: [companyId], format: 'strictly_e_learning', trainees: [], subProgram: { steps: [] } },
      ];
      const filteredCourseList = [
        {
          accessRules: [],
          format: 'strictly_e_learning',
          totalTheoreticalDuration: 'PT6480S',
          trainees: [
            { _id: traineeId, company: { _id: companyId } },
          ],
        },
        { accessRules: [companyId], format: 'strictly_e_learning', totalTheoreticalDuration: 'PT0S', trainees: [] },
      ];

      findCourseAndPopulate.returns(coursesList);

      const query = { company: companyId, format: 'strictly_e_learning', action: 'operations', origin: 'webapp' };
      const result = await CourseHelper.list(query, credentials);
      expect(result).toMatchObject(filteredCourseList);
      sinon.assert.calledOnceWithExactly(
        findCourseAndPopulate,
        { format: 'strictly_e_learning', accessRules: { $in: [companyId, []] } },
        'webapp'
      );
      sinon.assert.calledTwice(getTotalTheoreticalDurationSpy);
      sinon.assert.notCalled(userFindOne);
      sinon.assert.notCalled(find);
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
    });

    it('should return holding courses', async () => {
      const coursesList = [{ _id: new ObjectId(), misc: 'name' }, { _id: new ObjectId(), misc: 'program' }];

      findCourseAndPopulate.returns(coursesList);

      const query = {
        format: 'blended',
        action: 'operations',
        origin: 'webapp',
        isArchived: false,
        holding: credentials.holding._id,
      };
      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject(coursesList);
      sinon.assert.calledOnceWithExactly(
        findCourseAndPopulate,
        {
          format: 'blended',
          archivedAt: { $exists: false },
          $or: [{ companies: { $in: credentials.holding.companies } }, { holding: credentials.holding._id }],
        },
        'webapp'
      );
      sinon.assert.notCalled(getTotalTheoreticalDurationSpy);
      sinon.assert.notCalled(userFindOne);
      sinon.assert.notCalled(find);
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
    });
  });

  describe('PEDAGOGY', () => {
    it('should return courses for trainees, vendor', async () => {
      const traineeOrTutorId = new ObjectId();
      const stepId = new ObjectId();
      const courseIds = [new ObjectId(), new ObjectId()];
      const coursesList = [
        {
          misc: 'name',
          _id: courseIds[0],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Développement personnel full stack',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Développer des équipes agiles et autonomes',
              type: 'on_site',
              areActivitiesValid: true,
            },
            ],
          },
          slots: [
            {
              startDate: '2020-11-03T09:00:00.000Z',
              endDate: '2020-11-03T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2020-11-04T09:01:00.000Z',
              endDate: '2020-11-04T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
        {
          misc: 'program',
          _id: courseIds[1],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Brochure : le mal de dos',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Enjailler son équipe autonome',
              type: 'on_site',
              areActivitiesValid: true,
            }],
          },
          slots: [
            {
              startDate: '2019-11-06T09:00:00.000Z',
              endDate: '2019-11-06T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2019-12-22T09:00:00.000Z',
              endDate: '2019-12-22T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
      ];
      const query = { action: 'pedagogy', origin: 'webapp', trainee: traineeOrTutorId };

      find.onCall(0).returns(SinonMongoose.stubChainedQueries(courseIds, ['lean']));
      find.onCall(1).returns(SinonMongoose.stubChainedQueries(coursesList));

      formatCourseWithProgress.onCall(0).returns({
        ...coursesList[0],
        subProgram: {
          ...coursesList[0].subProgram,
          steps: [
            { ...coursesList[0].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[0].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });
      formatCourseWithProgress.onCall(1).returns({
        ...coursesList[1],
        subProgram: {
          ...coursesList[1].subProgram,
          steps: [
            { ...coursesList[1].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[1].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });

      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject({
        tutorCourses: [],
        traineeCourses: coursesList.map(
          course => (
            {
              ...course,
              subProgram: {
                ...course.subProgram,
                steps: [
                  { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
                  {
                    ...course.subProgram.steps[1],
                    progress: {
                      live: 1,
                      presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
                    },
                  },
                ],
              },
              progress: {
                eLearning: 1,
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            }
          )
        ),
      });

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [
              {
                $and: [
                  { $or: [{ trainees: traineeOrTutorId }, { tutors: traineeOrTutorId }] },
                  { $or: [{ format: STRICTLY_E_LEARNING }, { format: BLENDED }] },
                ],
              },
              { _id: 1, tutors: 1 },
            ],
          },
          { query: 'lean' },
        ],
        0
      );

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [{ _id: { $in: courseIds } }, { _id: 1, misc: 1, type: 1, format: 1 }],
          },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [{ path: 'activityHistories', match: { user: traineeOrTutorId } }],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [{
              path: 'slots',
              select: 'startDate endDate step',
              populate: [
                { path: 'step', select: 'type' },
                {
                  path: 'attendances',
                  match: { trainee: traineeOrTutorId },
                  options: { isVendorUser, requestingOwnInfos: false },
                },
              ],
            }],
          },
          { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
        ],
        1
      );

      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(0), coursesList[0], true);
      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(1), coursesList[1], true);
      sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
    });

    it('should return courses for trainees, client', async () => {
      const traineeCompany = new ObjectId();
      const traineeOrTutorId = new ObjectId();
      const stepId = new ObjectId();
      const courseIds = [new ObjectId(), new ObjectId(), new ObjectId()];
      const coursesList = [
        {
          misc: 'name',
          _id: courseIds[0],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Développement personnel full stack',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Développer des équipes agiles et autonomes',
              type: 'on_site',
              areActivitiesValid: true,
            },
            ],
          },
          slots: [
            {
              startDate: '2020-11-03T09:00:00.000Z',
              endDate: '2020-11-03T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2020-11-04T09:01:00.000Z',
              endDate: '2020-11-04T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
        {
          misc: 'program',
          _id: courseIds[1],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Brochure : le mal de dos',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Enjailler son équipe autonome',
              type: 'on_site',
              areActivitiesValid: true,
            }],
          },
          slots: [
            {
              startDate: '2019-11-06T09:00:00.000Z',
              endDate: '2019-11-06T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2019-12-22T09:00:00.000Z',
              endDate: '2019-12-22T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
        {
          misc: 'program',
          _id: courseIds[2],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Brochure : le mal de tête',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Enjailler ses bénéficiaires',
              type: 'on_site',
              areActivitiesValid: true,
            }],
          },
          slots: [
            {
              startDate: '2019-11-06T09:00:00.000Z',
              endDate: '2019-11-06T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2019-12-22T09:00:00.000Z',
              endDate: '2019-12-22T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
      ];
      const query = { action: 'pedagogy', company: traineeCompany, origin: 'webapp', trainee: traineeOrTutorId };

      find.onCall(0).returns(SinonMongoose.stubChainedQueries(courseIds, ['lean']));
      find.onCall(1).returns(SinonMongoose.stubChainedQueries(coursesList));

      formatCourseWithProgress.onCall(0).returns({
        ...coursesList[0],
        subProgram: {
          ...coursesList[0].subProgram,
          steps: [
            { ...coursesList[0].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[0].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });
      formatCourseWithProgress.onCall(1).returns({
        ...coursesList[1],
        subProgram: {
          ...coursesList[1].subProgram,
          steps: [
            { ...coursesList[1].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[1].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });
      getCompanyAtCourseRegistrationList.returns([
        { course: coursesList[0]._id, company: traineeCompany },
        { course: coursesList[1]._id, company: traineeCompany },
        { course: coursesList[2]._id, company: new ObjectId() },
      ]);

      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject({
        tutorCourses: [],
        traineeCourses: [coursesList[0], coursesList[1]].map(
          course => (
            {
              ...course,
              subProgram: {
                ...course.subProgram,
                steps: [
                  { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
                  {
                    ...course.subProgram.steps[1],
                    progress: {
                      live: 1,
                      presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
                    },
                  },
                ],
              },
              progress: {
                eLearning: 1,
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            }
          )
        ),
      });

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [
              {
                $and: [
                  { $or: [{ trainees: traineeOrTutorId }, { tutors: traineeOrTutorId }] },
                  {
                    $or: [
                      {
                        format: STRICTLY_E_LEARNING,
                        $or: [{ accessRules: [] }, { accessRules: { $in: [traineeCompany] } }],
                      },
                      { format: BLENDED, companies: { $in: [traineeCompany] } },
                    ],
                  },
                ],
              },
              { _id: 1, tutors: 1 },
            ],
          },
          { query: 'lean' },
        ],
        0
      );

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [{ _id: { $in: courseIds } }, { _id: 1, misc: 1, type: 1, format: 1 }],
          },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [{ path: 'activityHistories', match: { user: traineeOrTutorId } }],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [{
              path: 'slots',
              select: 'startDate endDate step',
              populate: [
                { path: 'step', select: 'type' },
                {
                  path: 'attendances',
                  match: { trainee: traineeOrTutorId, company: { $in: [traineeCompany] } },
                  options: { isVendorUser, requestingOwnInfos: false },
                },
              ],
            }],
          },
          { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
        ],
        1
      );

      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(0), coursesList[0], true);
      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(1), coursesList[1], true);
      sinon.assert.calledOnceWithExactly(
        getCompanyAtCourseRegistrationList,
        { key: TRAINEE, value: traineeOrTutorId },
        { key: COURSE, value: coursesList.map(course => course._id) }
      );
    });

    it('should return courses for trainees, holding', async () => {
      const traineeCompany = credentials.holding.companies[0];
      const traineeOrTutorId = new ObjectId();
      const stepId = new ObjectId();
      const courseIds = [new ObjectId(), new ObjectId(), new ObjectId()];
      const coursesList = [
        {
          misc: 'name',
          _id: courseIds[0],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Développement personnel full stack',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Développer des équipes agiles et autonomes',
              type: 'on_site',
              areActivitiesValid: true,
            },
            ],
          },
          slots: [
            {
              startDate: '2020-11-03T09:00:00.000Z',
              endDate: '2020-11-03T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2020-11-04T09:01:00.000Z',
              endDate: '2020-11-04T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
        {
          misc: 'program',
          _id: courseIds[1],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Brochure : le mal de dos',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Enjailler son équipe autonome',
              type: 'on_site',
              areActivitiesValid: true,
            }],
          },
          slots: [
            {
              startDate: '2019-11-06T09:00:00.000Z',
              endDate: '2019-11-06T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2019-12-22T09:00:00.000Z',
              endDate: '2019-12-22T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
        {
          misc: 'program',
          _id: courseIds[2],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Brochure : le mal de tête',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Enjailler ses bénéficiaires',
              type: 'on_site',
              areActivitiesValid: true,
            }],
          },
          slots: [
            {
              startDate: '2019-11-06T09:00:00.000Z',
              endDate: '2019-11-06T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2019-12-22T09:00:00.000Z',
              endDate: '2019-12-22T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
      ];
      const query = {
        action: 'pedagogy',
        holding: credentials.holding._id,
        origin: 'webapp',
        trainee: traineeOrTutorId,
      };

      find.onCall(0).returns(SinonMongoose.stubChainedQueries(courseIds, ['lean']));
      find.onCall(1).returns(SinonMongoose.stubChainedQueries(coursesList));

      formatCourseWithProgress.onCall(0).returns({
        ...coursesList[0],
        subProgram: {
          ...coursesList[0].subProgram,
          steps: [
            { ...coursesList[0].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[0].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });
      formatCourseWithProgress.onCall(1).returns({
        ...coursesList[1],
        subProgram: {
          ...coursesList[1].subProgram,
          steps: [
            { ...coursesList[1].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[1].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });
      getCompanyAtCourseRegistrationList.returns([
        { course: coursesList[0]._id, company: traineeCompany },
        { course: coursesList[1]._id, company: traineeCompany },
        { course: coursesList[2]._id, company: new ObjectId() },
      ]);

      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject({
        tutorCourses: [],
        traineeCourses: [coursesList[0], coursesList[1]].map(
          course => (
            {
              ...course,
              subProgram: {
                ...course.subProgram,
                steps: [
                  { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
                  {
                    ...course.subProgram.steps[1],
                    progress: {
                      live: 1,
                      presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
                    },
                  },
                ],
              },
              progress: {
                eLearning: 1,
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            }
          )
        ),
      });

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [
              {
                $and: [
                  { $or: [{ trainees: traineeOrTutorId }, { tutors: traineeOrTutorId }] },
                  {
                    $or: [
                      {
                        format: STRICTLY_E_LEARNING,
                        $or: [{ accessRules: [] }, { accessRules: { $in: credentials.holding.companies } }],
                      },
                      { format: BLENDED, companies: { $in: credentials.holding.companies } },
                    ],
                  },
                ],
              },
              { _id: 1, tutors: 1 },
            ],
          },
          { query: 'lean' },
        ],
        0
      );

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [{ _id: { $in: courseIds } }, { _id: 1, misc: 1, type: 1, format: 1 }],
          },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [{ path: 'activityHistories', match: { user: traineeOrTutorId } }],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [{
              path: 'slots',
              select: 'startDate endDate step',
              populate: [
                { path: 'step', select: 'type' },
                {
                  path: 'attendances',
                  match: { trainee: traineeOrTutorId, company: { $in: credentials.holding.companies } },
                  options: { isVendorUser, requestingOwnInfos: false },
                },
              ],
            }],
          },
          { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
        ],
        1
      );

      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(0), coursesList[0], true);
      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(1), coursesList[1], true);
      sinon.assert.calledOnceWithExactly(
        getCompanyAtCourseRegistrationList,
        { key: TRAINEE, value: traineeOrTutorId },
        { key: COURSE, value: coursesList.map(course => course._id) }
      );
    });

    it('should return courses for loggedUser (as trainee)', async () => {
      const traineeOrTutorId = credentials._id;
      const stepId = new ObjectId();
      const courseIds = [new ObjectId(), new ObjectId()];
      const coursesList = [
        {
          misc: 'name',
          _id: courseIds[0],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Développement personnel full stack',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Développer des équipes agiles et autonomes',
              type: 'on_site',
              areActivitiesValid: true,
            },
            ],
          },
          slots: [
            {
              startDate: '2020-11-03T09:00:00.000Z',
              endDate: '2020-11-03T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2020-11-04T09:01:00.000Z',
              endDate: '2020-11-04T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
        {
          misc: 'program',
          _id: courseIds[1],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Brochure : le mal de dos',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Enjailler son équipe autonome',
              type: 'on_site',
              areActivitiesValid: true,
            }],
          },
          slots: [
            {
              startDate: '2019-11-06T09:00:00.000Z',
              endDate: '2019-11-06T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2019-12-22T09:00:00.000Z',
              endDate: '2019-12-22T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
      ];
      const query = { action: 'pedagogy', origin: 'mobile' };

      find.onCall(0).returns(SinonMongoose.stubChainedQueries(courseIds, ['lean']));
      find.onCall(1).returns(SinonMongoose.stubChainedQueries(coursesList));

      formatCourseWithProgress.onCall(0).returns({
        ...coursesList[0],
        subProgram: {
          ...coursesList[0].subProgram,
          steps: [
            { ...coursesList[0].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[0].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });
      formatCourseWithProgress.onCall(1).returns({
        ...coursesList[1],
        subProgram: {
          ...coursesList[1].subProgram,
          steps: [
            { ...coursesList[1].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[1].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });

      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject({
        tutorCourses: [],
        traineeCourses: coursesList.map(
          course => (
            {
              ...course,
              subProgram: {
                ...course.subProgram,
                steps: [
                  { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
                  {
                    ...course.subProgram.steps[1],
                    progress: {
                      live: 1,
                      presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
                    },
                  },
                ],
              },
              progress: {
                eLearning: 1,
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            }
          )
        ),
      });

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [
              {
                $and: [
                  { $or: [{ trainees: traineeOrTutorId }, { tutors: traineeOrTutorId }] },
                  { $or: [{ format: STRICTLY_E_LEARNING }, { format: BLENDED }] },
                ],
              },
              { _id: 1, tutors: 1 },
            ],
          },
          { query: 'lean' },
        ],
        0
      );

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [{ _id: { $in: courseIds } }, { _id: 1, misc: 1, type: 1, format: 1 }],
          },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [{ path: 'activityHistories', match: { user: traineeOrTutorId } }],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [{
              path: 'slots',
              select: 'startDate endDate step',
              populate: [
                { path: 'step', select: 'type' },
                {
                  path: 'attendances',
                  match: { trainee: traineeOrTutorId },
                  options: { isVendorUser, requestingOwnInfos: true },
                },
              ],
            }],
          },
          { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
        ],
        1
      );

      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(0), coursesList[0], true);
      sinon.assert.calledWithExactly(formatCourseWithProgress.getCall(1), coursesList[1], true);
    });

    it('should return courses for tutor', async () => {
      const traineeOrTutorId = credentials._id;
      const stepId = new ObjectId();
      const tutorCourseIds = [new ObjectId()];
      const traineeCourseIds = [new ObjectId()];
      const coursesList = [
        {
          misc: 'name',
          _id: tutorCourseIds[0],
          format: BLENDED,
          tutors: [credentials._id],
          subProgram: {
            _id: new ObjectId(),
            program: { name: 'Programme' },
            steps: [
              { _id: new ObjectId(), type: 'e_learning', theoreticalDuration: 'PT5400S' },
              { _id: new ObjectId(), type: 'on_site' },
            ],
          },
        },
        {
          misc: 'program',
          _id: traineeCourseIds[0],
          format: BLENDED,
          subProgram: {
            steps: [{
              _id: new ObjectId(),
              activities: [{ activityHistories: [{}, {}] }],
              name: 'Brochure : le mal de dos',
              type: 'e_learning',
              theoreticalDuration: 'PT5400S',
              areActivitiesValid: false,
            },
            {
              _id: stepId,
              activities: [],
              name: 'Enjailler son équipe autonome',
              type: 'on_site',
              areActivitiesValid: true,
            }],
          },
          slots: [
            {
              startDate: '2019-11-06T09:00:00.000Z',
              endDate: '2019-11-06T12:00:00.000Z',
              step: stepId,
              attendances: [{ _id: new ObjectId() }],
            },
            {
              startDate: '2019-12-22T09:00:00.000Z',
              endDate: '2019-12-22T16:01:00.000Z',
              step: stepId,
              attendances: [],
            },
          ],
        },
      ];
      const query = { action: 'pedagogy', origin: 'mobile' };

      find
        .onCall(0)
        .returns(
          SinonMongoose
            .stubChainedQueries(
              [{ _id: tutorCourseIds[0], tutors: [credentials._id] }, { _id: traineeCourseIds[0] }],
              ['lean']
            )
        );
      find.onCall(1).returns(SinonMongoose.stubChainedQueries([coursesList[1]]));
      find.onCall(2).returns(SinonMongoose.stubChainedQueries([coursesList[0]]));

      formatCourseWithProgress.onCall(0).returns({
        ...coursesList[1],
        subProgram: {
          ...coursesList[1].subProgram,
          steps: [
            { ...coursesList[1].subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...coursesList[1].subProgram.steps[1],
              progress: { live: 1, presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } } },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });

      const result = await CourseHelper.list(query, credentials);

      expect(result).toMatchObject({
        tutorCourses: [coursesList[0]],
        traineeCourses: [{
          ...coursesList[1],
          subProgram: {
            ...coursesList[1].subProgram,
            steps: [
              { ...coursesList[1].subProgram.steps[0], progress: { eLearning: 1 } },
              {
                ...coursesList[1].subProgram.steps[1],
                progress: {
                  live: 1,
                  presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
                },
              },
            ],
          },
          progress: {
            eLearning: 1,
            live: 1,
            presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
          },
        }],
      });

      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [
              {
                $and: [
                  { $or: [{ trainees: traineeOrTutorId }, { tutors: traineeOrTutorId }] },
                  { $or: [{ format: STRICTLY_E_LEARNING }, { format: BLENDED }] },
                ],
              },
              { _id: 1, tutors: 1 },
            ],
          },
          { query: 'lean' },
        ],
        0
      );
      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [{ _id: { $in: traineeCourseIds } }, { _id: 1, misc: 1, type: 1, format: 1 }],
          },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [{ path: 'activityHistories', match: { user: traineeOrTutorId } }],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [{
              path: 'slots',
              select: 'startDate endDate step',
              populate: [
                { path: 'step', select: 'type' },
                {
                  path: 'attendances',
                  match: { trainee: traineeOrTutorId },
                  options: { isVendorUser, requestingOwnInfos: true },
                },
              ],
            }],
          },
          { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
        ],
        1
      );
      SinonMongoose.calledWithExactly(
        find,
        [
          {
            query: 'find',
            args: [{ _id: { $in: tutorCourseIds } }, { _id: 1, misc: 1, type: 1, format: 1, tutors: 1 }],
          },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description' },
                { path: 'steps', select: 'type theoreticalDuration' },
              ],
            }],
          },
          { query: 'lean' },
        ],
        2
      );

      sinon.assert.calledOnceWithExactly(formatCourseWithProgress, coursesList[1], true);
    });
  });
});

describe('getCourseProgress', () => {
  it('should get progress for course whose steps only have one progress', async () => {
    const steps = [{
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
      progress: { eLearning: 1 },
    },
    {
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
      progress: { eLearning: 1 },
    }];

    const result = await CourseHelper.getCourseProgress(steps);
    expect(result).toEqual({ blended: 1, eLearning: 1 });
  });

  it('should get progress for course whose on site steps have severals progresses', async () => {
    const steps = [{
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
      progress: { eLearning: 1 },
    },
    {
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: ON_SITE,
      areActivitiesValid: false,
      progress: {
        live: 0.75,
        eLearning: 0.5,
        presence: { attendanceDuration: 'PT120M', maxDuration: 'PT180M' },
      },
    }];

    const result = await CourseHelper.getCourseProgress(steps);
    expect(result).toEqual({
      blended: 0.875,
      eLearning: 0.75,
      presence: { attendanceDuration: 'PT120M', maxDuration: 'PT180M' },
    });
  });

  it('should get progress for course whose a step has progress at 0', async () => {
    const steps = [{
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: E_LEARNING,
      areActivitiesValid: false,
      progress: { eLearning: 0 },
    },
    {
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: ON_SITE,
      areActivitiesValid: false,
      progress: { live: 1, presence: { attendanceDuration: 'PT120M', maxDuration: 'PT180M' } },
    }];

    const result = await CourseHelper.getCourseProgress(steps);
    expect(result).toEqual({
      blended: 0.5,
      eLearning: 0,
      presence: { attendanceDuration: 'PT120M', maxDuration: 'PT180M' },
    });
  });

  it('should get progress for course whose steps have presence progress', async () => {
    const steps = [{
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: ON_SITE,
      areActivitiesValid: false,
      progress: {
        eLearning: 1,
        live: 0.5,
        presence: { attendanceDuration: 'PT120M', maxDuration: 'PT240M' },
      },
    },
    {
      _id: new ObjectId(),
      activities: [{ activityHistories: [{}, {}] }],
      name: 'Développement personnel full stack',
      type: ON_SITE,
      areActivitiesValid: false,
      progress: { live: 1, presence: { attendanceDuration: 'PT120M', maxDuration: 'PT180M' } },
    }];

    const result = await CourseHelper.getCourseProgress(steps);
    expect(result).toEqual({
      blended: 0.75,
      eLearning: 1,
      presence: { attendanceDuration: 'PT240M', maxDuration: 'PT420M' },
    });
  });

  it('should return empty object if no step', async () => {
    const steps = [];

    const result = await CourseHelper.getCourseProgress(steps);
    expect(result).toEqual({});
  });
});

describe('formatCourseWithProgress', () => {
  let getProgress;
  let getCourseProgress;
  beforeEach(() => {
    getCourseProgress = sinon.stub(CourseHelper, 'getCourseProgress');
    getProgress = sinon.stub(StepsHelper, 'getProgress');
  });

  afterEach(() => {
    getCourseProgress.restore();
    getProgress.restore();
  });

  it('should format course with presence progress', async () => {
    const stepId = new ObjectId();
    const course = {
      misc: 'name',
      _id: new ObjectId(),
      subProgram: {
        steps: [{
          _id: new ObjectId(),
          activities: [{ activityHistories: [{}, {}] }],
          name: 'Développement personnel full stack',
          type: 'e_learning',
          areActivitiesValid: false,
        },
        {
          _id: stepId,
          activities: [],
          name: 'Développer des équipes agiles et autonomes',
          type: 'on_site',
          areActivitiesValid: true,
        },
        ],
      },
      slots: [{
        startDate: '2020-11-03T09:00:00.000Z',
        endDate: '2020-11-03T12:00:00.000Z',
        step: { _id: stepId },
        attendances: [],
      }, {
        startDate: '2020-11-04T09:00:00.000Z',
        endDate: '2020-11-04T16:01:00.000Z',
        step: { _id: stepId },
        attendances: [],
      }],
    };
    getProgress.onCall(0).returns({ eLearning: 1 });
    getProgress.onCall(1).returns({
      live: 1,
      presence: { attendanceDuration: { minutes: 0 }, maxDuration: { minutes: 601 } },
    });
    getCourseProgress.returns({
      eLearning: 1,
      live: 1,
      presence: { attendanceDuration: { minutes: 0 }, maxDuration: { minutes: 601 } },
    });

    const result = await CourseHelper.formatCourseWithProgress(course, true);

    expect(result).toMatchObject({
      ...course,
      subProgram: {
        ...course.subProgram,
        steps: [
          { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
          {
            ...course.subProgram.steps[1],
            progress: { live: 1, presence: { attendanceDuration: { minutes: 0 }, maxDuration: { minutes: 601 } } },
          },
        ],
      },
      progress: {
        eLearning: 1,
        live: 1,
        presence: { attendanceDuration: { minutes: 0 }, maxDuration: { minutes: 601 } },
      },
    });
    sinon.assert.calledWithExactly(getProgress.getCall(0), course.subProgram.steps[0], [], true);
    sinon.assert.calledWithExactly(getProgress.getCall(1), course.subProgram.steps[1], course.slots, true);
    sinon.assert.calledWithExactly(getCourseProgress.getCall(0), [
      { ...course.subProgram.steps[0], slots: [], progress: { eLearning: 1 } },
      {
        ...course.subProgram.steps[1],
        slots: course.slots,
        progress: { live: 1, presence: { attendanceDuration: { minutes: 0 }, maxDuration: { minutes: 601 } } },
      },
    ]);
  });

  it('should format course without presence progress', async () => {
    const stepId = new ObjectId();
    const course = {
      misc: 'name',
      _id: new ObjectId(),
      subProgram: {
        steps: [{
          _id: new ObjectId(),
          activities: [{ activityHistories: [{}, {}] }],
          name: 'Développement personnel full stack',
          type: 'e_learning',
          areActivitiesValid: false,
        },
        {
          _id: stepId,
          activities: [],
          name: 'Développer des équipes agiles et autonomes',
          type: 'on_site',
          areActivitiesValid: true,
        },
        ],
      },
      slots: [{
        startDate: '2020-11-03T09:00:00.000Z',
        endDate: '2020-11-03T12:00:00.000Z',
        step: { _id: stepId },
        attendances: [],
      }, {
        startDate: '2020-11-04T09:00:00.000Z',
        endDate: '2020-11-04T16:01:00.000Z',
        step: { _id: stepId },
        attendances: [],
      }],
    };
    getProgress.onCall(0).returns({ eLearning: 1 });
    getProgress.onCall(1).returns({ live: 1 });
    getCourseProgress.returns({ eLearning: 1, live: 1 });

    const result = await CourseHelper.formatCourseWithProgress(course);

    expect(result).toMatchObject({
      ...course,
      subProgram: {
        ...course.subProgram,
        steps: [
          { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
          { ...course.subProgram.steps[1], progress: { live: 1 } },
        ],
      },
      progress: { eLearning: 1, live: 1 },
    });
    sinon.assert.calledWithExactly(getProgress.getCall(0), course.subProgram.steps[0], [], false);
    sinon.assert.calledWithExactly(getProgress.getCall(1), course.subProgram.steps[1], course.slots, false);
    sinon.assert.calledWithExactly(getCourseProgress.getCall(0), [
      { ...course.subProgram.steps[0], slots: [], progress: { eLearning: 1 } },
      { ...course.subProgram.steps[1], slots: course.slots, progress: { live: 1 } },
    ]);
  });
});

describe('getCourse', () => {
  let findOne;
  let formatCourseWithProgress;
  let attendanceCountDocuments;
  beforeEach(() => {
    findOne = sinon.stub(Course, 'findOne');
    formatCourseWithProgress = sinon.stub(CourseHelper, 'formatCourseWithProgress');
    attendanceCountDocuments = sinon.stub(Attendance, 'countDocuments');
  });
  afterEach(() => {
    findOne.restore();
    formatCourseWithProgress.restore();
    attendanceCountDocuments.restore();
  });

  describe('OPERATIONS', () => {
    let getCompanyAtCourseRegistrationList;
    const authCompanyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const traineeIds = [new ObjectId(), new ObjectId()];

    beforeEach(() => {
      getCompanyAtCourseRegistrationList =
        sinon.stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
    });

    afterEach(() => {
      getCompanyAtCourseRegistrationList.restore();
    });

    it('should return inter b2b course without trainees filtering (webapp)', async () => {
      const course = {
        _id: new ObjectId(),
        type: INTER_B2B,
        format: BLENDED,
        trainees: [{ _id: traineeIds[0] }, { _id: traineeIds[1] }],
        subProgram: { steps: [{ theoreticalDuration: 'PT3600S' }, { theoreticalDuration: 'PT1800S' }] },
        slots: [{ step: new ObjectId() }],
      };
      findOne.returns(SinonMongoose.stubChainedQueries(course));
      getCompanyAtCourseRegistrationList.returns([
        { trainee: traineeIds[0], company: authCompanyId },
        { trainee: traineeIds[1], company: otherCompanyId },
      ]);

      const result = await CourseHelper.getCourse(
        { action: OPERATIONS, origin: WEBAPP },
        { _id: course._id },
        { role: { vendor: { name: 'vendor_admin' } }, company: { _id: new ObjectId() } }
      );
      expect(result).toMatchObject({
        ...course,
        totalTheoreticalDuration: 'PT5400S',
        trainees: [
          { _id: traineeIds[0], registrationCompany: authCompanyId },
          { _id: traineeIds[1], registrationCompany: otherCompanyId },
        ],
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [[
              {
                path: 'companies',
                select: 'name',
                populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
              },
              {
                path: 'trainees',
                select: 'identity.firstname identity.lastname local.email contact picture.link '
                  + 'firstMobileConnectionDate loginCode',
                populate: { path: 'company' },
              },
              {
                path: 'companyRepresentative',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              {
                path: 'subProgram',
                select: 'program steps',
                populate: [
                  { path: 'program', select: 'name learningGoals' },
                  {
                    path: 'steps',
                    select: 'name type theoreticalDuration',
                    populate: {
                      path: 'activities', select: 'name type', populate: { path: 'activityHistories', select: 'user' },
                    },
                  },
                ],
              },
              {
                path: 'tutors',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              { path: 'slots', select: 'step startDate endDate address meetingLink' },
              { path: 'slotsToPlan', select: '_id step' },
              {
                path: 'trainers',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              { path: 'accessRules', select: 'name' },
              {
                path: 'operationsRepresentative',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              {
                path: 'salesRepresentative',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              { path: 'contact', select: 'identity.firstname identity.lastname contact.phone' },
              { path: 'trainerMissions', select: '_id trainer', options: { isVendorUser: true } },
            ]],
          },
          { query: 'lean' },
        ]
      );
      sinon.assert.calledOnceWithExactly(
        getCompanyAtCourseRegistrationList,
        { key: COURSE, value: course._id },
        { key: TRAINEE, value: [traineeIds[0], traineeIds[1]] }
      );
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(attendanceCountDocuments);
    });

    it('should return inter b2b course with trainees filtering on company (webapp)', async () => {
      const course = {
        _id: new ObjectId(),
        type: INTER_B2B,
        format: BLENDED,
        trainees: [{ _id: traineeIds[0] }, { _id: traineeIds[1] }],
        subProgram: { steps: [] },
        slots: [{ step: new ObjectId() }],
      };

      const courseWithFilteredTrainees = {
        type: INTER_B2B,
        trainees: [{ _id: traineeIds[0], registrationCompany: authCompanyId }],
        totalTheoreticalDuration: 'PT0S',
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course));
      getCompanyAtCourseRegistrationList.returns([
        { trainee: traineeIds[0], company: authCompanyId },
        { trainee: traineeIds[1], company: otherCompanyId },
      ]);

      const result = await CourseHelper.getCourse(
        { action: OPERATIONS, origin: WEBAPP },
        { _id: course._id },
        { role: { client: { name: 'client_admin' } }, company: { _id: authCompanyId } }
      );

      expect(result).toMatchObject(courseWithFilteredTrainees);
      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [
              [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                {
                  path: 'trainees',
                  select: 'identity.firstname identity.lastname local.email contact picture.link '
                    + 'firstMobileConnectionDate loginCode',
                  populate: { path: 'company' },
                },
                {
                  path: 'companyRepresentative',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                {
                  path: 'subProgram',
                  select: 'program steps',
                  populate: [
                    { path: 'program', select: 'name learningGoals' },
                    {
                      path: 'steps',
                      select: 'name type theoreticalDuration',
                      populate: {
                        path: 'activities',
                        select: 'name type',
                        populate: { path: 'activityHistories', select: 'user' },
                      },
                    },
                  ],
                },
                {
                  path: 'tutors',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                { path: 'slots', select: 'step startDate endDate address meetingLink' },
                { path: 'slotsToPlan', select: '_id step' },
                {
                  path: 'trainers',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                { path: 'accessRules', select: 'name' },
                {
                  path: 'operationsRepresentative',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                {
                  path: 'salesRepresentative',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                { path: 'contact', select: 'identity.firstname identity.lastname contact.phone' },
              ]],
          },
          { query: 'lean' },
        ]
      );
      sinon.assert.calledOnceWithExactly(
        getCompanyAtCourseRegistrationList,
        { key: COURSE, value: course._id },
        { key: TRAINEE, value: [traineeIds[0], traineeIds[1]] }
      );
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(attendanceCountDocuments);
    });

    it('should return inter b2b course with trainees filtering on holding (webapp)', async () => {
      const course = {
        _id: new ObjectId(),
        type: INTER_B2B,
        format: BLENDED,
        trainees: [{ _id: traineeIds[0] }, { _id: traineeIds[1] }],
        subProgram: { steps: [] },
        slots: [{ step: new ObjectId() }],
      };

      const courseWithFilteredTrainees = {
        type: INTER_B2B,
        trainees: [{ _id: traineeIds[0], registrationCompany: authCompanyId }],
        totalTheoreticalDuration: 'PT0S',
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course));
      getCompanyAtCourseRegistrationList.returns([
        { trainee: traineeIds[0], company: authCompanyId },
        { trainee: traineeIds[1], company: otherCompanyId },
      ]);

      const result = await CourseHelper.getCourse(
        { action: OPERATIONS, origin: WEBAPP },
        { _id: course._id },
        { role: { holding: { name: 'holding_admin' } }, holding: { _id: new ObjectId(), companies: [authCompanyId] } }
      );

      expect(result).toMatchObject(courseWithFilteredTrainees);
      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [
              [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                {
                  path: 'trainees',
                  select: 'identity.firstname identity.lastname local.email contact picture.link '
                    + 'firstMobileConnectionDate loginCode',
                  populate: { path: 'company' },
                },
                {
                  path: 'companyRepresentative',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                {
                  path: 'subProgram',
                  select: 'program steps',
                  populate: [
                    { path: 'program', select: 'name learningGoals' },
                    {
                      path: 'steps',
                      select: 'name type theoreticalDuration',
                      populate: {
                        path: 'activities',
                        select: 'name type',
                        populate: { path: 'activityHistories', select: 'user' },
                      },
                    },
                  ],
                },
                {
                  path: 'tutors',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                { path: 'slots', select: 'step startDate endDate address meetingLink' },
                { path: 'slotsToPlan', select: '_id step' },
                {
                  path: 'trainers',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                { path: 'accessRules', select: 'name' },
                {
                  path: 'operationsRepresentative',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                {
                  path: 'salesRepresentative',
                  select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
                },
                { path: 'contact', select: 'identity.firstname identity.lastname contact.phone' },
              ]],
          },
          { query: 'lean' },
        ]
      );
      sinon.assert.calledOnceWithExactly(
        getCompanyAtCourseRegistrationList,
        { key: COURSE, value: course._id },
        { key: TRAINEE, value: [traineeIds[0], traineeIds[1]] }
      );
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(attendanceCountDocuments);
    });

    it('should return course for trainer (mobile)', async () => {
      const course = {
        _id: new ObjectId(),
        type: INTER_B2B,
        format: BLENDED,
        trainees: [{ _id: traineeIds[0] }, { _id: traineeIds[1] }],
        subProgram: { steps: [{ theoreticalDuration: 'PT3600S' }, { theoreticalDuration: 'PT1800S' }] },
      };
      findOne.returns(SinonMongoose.stubChainedQueries(course));
      getCompanyAtCourseRegistrationList.returns([
        { trainee: traineeIds[0], company: authCompanyId },
        { trainee: traineeIds[1], company: otherCompanyId },
      ]);

      const result = await CourseHelper.getCourse(
        { action: OPERATIONS, origin: MOBILE },
        { _id: course._id },
        { role: { vendor: { name: 'trainer' } }, company: { _id: new ObjectId() } }
      );
      expect(result).toMatchObject({
        ...course,
        totalTheoreticalDuration: 'PT5400S',
        trainees: [
          { _id: traineeIds[0], registrationCompany: authCompanyId },
          { _id: traineeIds[1], registrationCompany: otherCompanyId },
        ],
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [[
              { path: 'companies', select: 'name' },
              {
                path: 'trainees',
                select: 'identity.firstname identity.lastname local.email contact picture.link '
                  + 'firstMobileConnectionDate loginCode',
                populate: { path: 'company' },
              },
              {
                path: 'companyRepresentative',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              {
                path: 'subProgram',
                select: 'program steps',
                populate: [
                  { path: 'program', select: 'name learningGoals' },
                  { path: 'steps', select: 'name' },
                ],
              },
              { path: 'slots', select: 'step startDate endDate', options: { sort: { startDate: 1 } } },
            ]],
          },
          { query: 'lean' },
        ]
      );
      sinon.assert.calledOnceWithExactly(
        getCompanyAtCourseRegistrationList,
        { key: COURSE, value: course._id },
        { key: TRAINEE, value: [traineeIds[0], traineeIds[1]] }
      );
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(attendanceCountDocuments);
    });

    it('should return eLearning course with trainees filtering (webapp)', async () => {
      const course = {
        _id: new ObjectId(),
        type: INTER_B2C,
        format: E_LEARNING,
        trainees: [{ _id: new ObjectId(), company: authCompanyId }],
        subProgram: {
          steps: [{
            _id: new ObjectId(),
            activities: [],
            name: 'Développement personnel',
            type: 'e_learning',
            theoreticalDuration: 'PT5400S',
            areActivitiesValid: false,
          }],
        },
      };
      findOne.returns(SinonMongoose.stubChainedQueries(course));

      const result = await CourseHelper.getCourse(
        { action: OPERATIONS, origin: WEBAPP },
        { _id: course._id },
        { role: { client: { name: 'client_admin' } }, company: { _id: authCompanyId } }
      );
      expect(result).toMatchObject({
        ...course,
        totalTheoreticalDuration: 'PT5400S',
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [[
              {
                path: 'companies',
                select: 'name',
                populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
              },
              {
                path: 'trainees',
                select: 'identity.firstname identity.lastname local.email contact picture.link '
                  + 'firstMobileConnectionDate loginCode',
                populate: { path: 'company' },

              },
              {
                path: 'companyRepresentative',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              {
                path: 'subProgram',
                select: 'program steps',
                populate: [
                  { path: 'program', select: 'name learningGoals' },
                  {
                    path: 'steps',
                    select: 'name type theoreticalDuration',
                    populate: {
                      path: 'activities', select: 'name type', populate: { path: 'activityHistories', select: 'user' },
                    },
                  },
                ],
              },
              {
                path: 'tutors',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              { path: 'slots', select: 'step startDate endDate address meetingLink' },
              { path: 'slotsToPlan', select: '_id step' },
              {
                path: 'trainers',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              { path: 'accessRules', select: 'name' },
              {
                path: 'operationsRepresentative',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              {
                path: 'salesRepresentative',
                select: 'identity.firstname identity.lastname contact.phone local.email picture.link',
              },
              { path: 'contact', select: 'identity.firstname identity.lastname contact.phone' },
            ]],
          },
          { query: 'lean' },
        ]
      );
      sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(attendanceCountDocuments);
    });
  });

  describe('PEDAGOGY', () => {
    it('should return elearning course for trainee', async () => {
      const authCompanyId = new ObjectId();
      const loggedUser = {
        _id: new ObjectId(),
        role: { client: { name: 'client_admin' } },
        company: { _id: authCompanyId },
      };
      const course = {
        _id: new ObjectId(),
        subProgram: {
          isStrictlyELearning: true,
          steps: [{
            _id: new ObjectId(),
            activities: [{ activityHistories: [{}, {}] }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
            theoreticalDuration: 'PT1800S',
          },
          ],
        },
        trainers: [
          { _id: new ObjectId(), identity: { firstname: 'Paul', lastName: 'Durand' }, biography: 'voici ma bio' },
        ],
        tutors: [{ _id: new ObjectId(), identity: { firstname: 'Pauline', lastName: 'Durand' } }],
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course, ['populate', 'select', 'lean']));

      formatCourseWithProgress.returns({
        ...course,
        subProgram: {
          ...course.subProgram,
          steps: [{ ...course.subProgram.steps[0], progress: { eLearning: 1 } }],
        },
        progress: { eLearning: 1 },
      });

      const result = await CourseHelper.getCourse({ action: PEDAGOGY }, { _id: course._id }, loggedUser);
      expect(result).toMatchObject({
        ...course,
        subProgram: {
          ...course.subProgram,
          steps: [{ ...course.subProgram.steps[0], progress: { eLearning: 1 } }],
        },
        progress: { eLearning: 1 },
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description learningGoals' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [
                      { path: 'activityHistories', match: { user: loggedUser._id } },
                      { path: 'cards', select: 'template' },
                    ],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [
              {
                path: 'slots',
                select: 'startDate endDate step address meetingLink',
                populate: { path: 'step', select: 'type' },
                options: { sort: { startDate: 1 } },
              },
            ],
          },
          {
            query: 'populate',
            args: [{ path: 'trainers', select: 'identity.firstname identity.lastname biography picture' }],
          },
          { query: 'populate', args: [{ path: 'tutors', select: 'identity.firstname identity.lastname picture' }] },
          {
            query: 'populate',
            args: [{ path: 'contact', select: 'identity.firstname identity.lastname contact.phone local.email' }],
          },
          {
            query: 'populate',
            args: [{
              path: 'attendanceSheets',
              match: { trainee: loggedUser._id },
              options: { requestingOwnInfos: true },
              populate: [{ path: 'slots', select: 'startDate endDate step' }, { path: 'trainer', select: 'identity' }],
            }],
          },
          { query: 'select', args: ['_id misc format'] },
          { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
        ]
      );

      sinon.assert.calledOnceWithExactly(formatCourseWithProgress, course);
      sinon.assert.notCalled(attendanceCountDocuments);
    });

    it('should return blended course for trainee (no attendance on last slot)', async () => {
      const authCompanyId = new ObjectId();
      const loggedUser = {
        _id: new ObjectId(),
        role: { client: { name: 'client_admin' } },
        company: { _id: authCompanyId },
      };
      const stepId = new ObjectId();
      const lastSlotId = new ObjectId();
      const course = {
        _id: new ObjectId(),
        subProgram: {
          isStrictlyELearning: false,
          steps: [{
            _id: new ObjectId(),
            activities: [{ activityHistories: [{}, {}] }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
            theoreticalDuration: 'PT1800S',
          },
          {
            _id: stepId,
            activities: [],
            name: 'Développer des équipes agiles et autonomes',
            type: 'on_site',
            areActivitiesValid: true,
            theoreticalDuration: 'PT12600S',
          },
          ],
        },
        slots: [
          {
            _id: new ObjectId(),
            startDate: '2020-11-03T09:00:00.000Z',
            endDate: '2020-11-03T12:00:00.000Z',
            step: stepId,
            attendances: [{ _id: new ObjectId() }],
          },
          {
            _id: lastSlotId,
            startDate: '2020-11-04T09:00:00.000Z',
            endDate: '2020-11-04T16:01:00.000Z',
            step: stepId,
            attendances: [],
          },
        ],
        trainers: [
          { _id: new ObjectId(), identity: { firstname: 'Paul', lastName: 'Durand' }, biography: 'voici ma bio' },
        ],
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course, ['populate', 'select', 'lean']));
      attendanceCountDocuments.returns(0);

      formatCourseWithProgress.returns({
        ...course,
        areLastSlotAttendancesValidated: false,
        subProgram: {
          ...course.subProgram,
          steps: [
            { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...course.subProgram.steps[1],
              progress: {
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });

      const result = await CourseHelper.getCourse({ action: PEDAGOGY }, { _id: course._id }, loggedUser);

      expect(result).toMatchObject({
        ...course,
        areLastSlotAttendancesValidated: false,
        subProgram: {
          ...course.subProgram,
          steps: [
            { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...course.subProgram.steps[1],
              progress: {
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description learningGoals' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [
                      { path: 'activityHistories', match: { user: loggedUser._id } },
                      { path: 'cards', select: 'template' },
                    ],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [
              {
                path: 'slots',
                select: 'startDate endDate step address meetingLink',
                populate: { path: 'step', select: 'type' },
                options: { sort: { startDate: 1 } },
              },
            ],
          },
          {
            query: 'populate',
            args: [{ path: 'trainers', select: 'identity.firstname identity.lastname biography picture' }],
          },
          { query: 'populate', args: [{ path: 'tutors', select: 'identity.firstname identity.lastname picture' }] },
          {
            query: 'populate',
            args: [{ path: 'contact', select: 'identity.firstname identity.lastname contact.phone local.email' }],
          },
          {
            query: 'populate',
            args: [{
              path: 'attendanceSheets',
              match: { trainee: loggedUser._id },
              options: { requestingOwnInfos: true },
              populate: [{ path: 'slots', select: 'startDate endDate step' }, { path: 'trainer', select: 'identity' }],
            }],
          },
          { query: 'select', args: ['_id misc format'] },
          { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
        ]
      );

      sinon.assert.calledOnceWithExactly(formatCourseWithProgress, course);
      sinon.assert.calledOnceWithExactly(attendanceCountDocuments, { courseSlot: lastSlotId });
    });

    it('should return blended course for trainee (attendance on last slot)', async () => {
      const authCompanyId = new ObjectId();
      const loggedUser = {
        _id: new ObjectId(),
        role: { client: { name: 'client_admin' } },
        company: { _id: authCompanyId },
      };
      const stepId = new ObjectId();
      const lastSlotId = new ObjectId();
      const course = {
        _id: new ObjectId(),
        subProgram: {
          isStrictlyELearning: false,
          steps: [{
            _id: new ObjectId(),
            activities: [{ activityHistories: [{}, {}] }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
            theoreticalDuration: 'PT1800S',
          },
          {
            _id: stepId,
            activities: [],
            name: 'Développer des équipes agiles et autonomes',
            type: 'on_site',
            areActivitiesValid: true,
            theoreticalDuration: 'PT12600S',
          },
          ],
        },
        slots: [
          {
            _id: new ObjectId(),
            startDate: '2020-11-03T09:00:00.000Z',
            endDate: '2020-11-03T12:00:00.000Z',
            step: stepId,
            attendances: [{ _id: new ObjectId() }],
          },
          {
            _id: lastSlotId,
            startDate: '2020-11-04T09:00:00.000Z',
            endDate: '2020-11-04T16:01:00.000Z',
            step: stepId,
            attendances: [{ _id: new ObjectId() }],
          },
        ],
        trainers: [
          { _id: new ObjectId(), identity: { firstname: 'Paul', lastName: 'Durand' }, biography: 'voici ma bio' },
        ],
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course, ['populate', 'select', 'lean']));
      attendanceCountDocuments.returns(1);

      formatCourseWithProgress.returns({
        ...course,
        areLastSlotAttendancesValidated: true,
        subProgram: {
          ...course.subProgram,
          steps: [
            { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...course.subProgram.steps[1],
              progress: {
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });

      const result = await CourseHelper.getCourse({ action: PEDAGOGY }, { _id: course._id }, loggedUser);

      expect(result).toMatchObject({
        ...course,
        areLastSlotAttendancesValidated: true,
        subProgram: {
          ...course.subProgram,
          steps: [
            { ...course.subProgram.steps[0], progress: { eLearning: 1 } },
            {
              ...course.subProgram.steps[1],
              progress: {
                live: 1,
                presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
              },
            },
          ],
        },
        progress: {
          eLearning: 1,
          live: 1,
          presence: { attendanceDuration: { minutes: 180 }, maxDuration: { minutes: 601 } },
        },
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description learningGoals' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [
                      { path: 'activityHistories', match: { user: loggedUser._id } },
                      { path: 'cards', select: 'template' },
                    ],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [
              {
                path: 'slots',
                select: 'startDate endDate step address meetingLink',
                populate: { path: 'step', select: 'type' },
                options: { sort: { startDate: 1 } },
              },
            ],
          },
          {
            query: 'populate',
            args: [{ path: 'trainers', select: 'identity.firstname identity.lastname biography picture' }],
          },
          { query: 'populate', args: [{ path: 'tutors', select: 'identity.firstname identity.lastname picture' }] },
          {
            query: 'populate',
            args: [{ path: 'contact', select: 'identity.firstname identity.lastname contact.phone local.email' }],
          },
          {
            query: 'populate',
            args: [{
              path: 'attendanceSheets',
              match: { trainee: loggedUser._id },
              options: { requestingOwnInfos: true },
              populate: [{ path: 'slots', select: 'startDate endDate step' }, { path: 'trainer', select: 'identity' }],
            }],
          },
          { query: 'select', args: ['_id misc format'] },
          { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
        ]
      );

      sinon.assert.calledOnceWithExactly(formatCourseWithProgress, course);
      sinon.assert.calledOnceWithExactly(attendanceCountDocuments, { courseSlot: lastSlotId });
    });

    it('should return course as trainer', async () => {
      const authCompanyId = new ObjectId();
      const loggedUser = {
        _id: new ObjectId(),
        role: { vendor: { name: 'trainer' } },
        company: { _id: authCompanyId },
      };
      const courseId = new ObjectId();
      const course = {
        _id: courseId,
        subProgram: {
          isStrictlyELearning: false,
          steps: [{
            activities: [{ activityHistories: [{ user: loggedUser._id }, { user: loggedUser._id }] }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
            theoreticalDuration: 'PT1800S',
          },
          {
            activities: [],
            name: 'Développer des équipes agiles et autonomes',
            type: 'on_site',
            areActivitiesValid: true,
            theoreticalDuration: 'PT12600S',
          },
          ],
        },
        slots: [{ startDate: '2020-11-03T09:00:00.000Z', endDate: '2020-11-03T12:00:00.000Z' }],
        trainers: [{ _id: loggedUser._id }],
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course, ['populate', 'select', 'lean']));

      const result = await CourseHelper.getCourse({ action: PEDAGOGY }, { _id: course._id }, loggedUser);

      expect(result).toMatchObject({
        _id: courseId,
        subProgram: {
          isStrictlyELearning: false,
          steps: [{
            activities: [{ }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
            theoreticalDuration: 'PT1800S',
          },
          {
            activities: [],
            name: 'Développer des équipes agiles et autonomes',
            type: 'on_site',
            areActivitiesValid: true,
            theoreticalDuration: 'PT12600S',
          },
          ],
        },
        slots: [{ startDate: '2020-11-03T09:00:00.000Z', endDate: '2020-11-03T12:00:00.000Z' }],
        trainers: [{ _id: loggedUser._id }],
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description learningGoals' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [
                      { path: 'activityHistories', match: { user: loggedUser._id } },
                      { path: 'cards', select: 'template' },
                    ],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [
              {
                path: 'slots',
                select: 'startDate endDate step address meetingLink',
                populate: { path: 'step', select: 'type' },
                options: { sort: { startDate: 1 } },
              },
            ],
          },
          {
            query: 'populate',
            args: [{ path: 'trainers', select: 'identity.firstname identity.lastname biography picture' }],
          },
          { query: 'populate', args: [{ path: 'tutors', select: 'identity.firstname identity.lastname picture' }] },
          {
            query: 'populate',
            args: [{ path: 'contact', select: 'identity.firstname identity.lastname contact.phone local.email' }],
          },
          {
            query: 'populate',
            args: [{
              path: 'attendanceSheets',
              match: { trainee: loggedUser._id },
              options: { requestingOwnInfos: true },
              populate: [{ path: 'slots', select: 'startDate endDate step' }, { path: 'trainer', select: 'identity' }],
            }],
          },
          { query: 'select', args: ['_id misc format'] },
          { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
        ]
      );

      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(attendanceCountDocuments);
    });

    it('should return course as tutor', async () => {
      const authCompanyId = new ObjectId();
      const loggedUser = {
        _id: new ObjectId(),
        company: { _id: authCompanyId },
      };
      const courseId = new ObjectId();
      const course = {
        _id: courseId,
        subProgram: {
          isStrictlyELearning: false,
          steps: [{
            activities: [{ activityHistories: [{ user: loggedUser._id }, { user: loggedUser._id }] }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
            theoreticalDuration: 'PT1800S',
          },
          {
            activities: [],
            name: 'Développer des équipes agiles et autonomes',
            type: 'on_site',
            areActivitiesValid: true,
            theoreticalDuration: 'PT12600S',
          },
          ],
        },
        slots: [{ startDate: '2020-11-03T09:00:00.000Z', endDate: '2020-11-03T12:00:00.000Z' }],
        tutors: [{ _id: loggedUser._id }],
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course, ['populate', 'select', 'lean']));

      const result = await CourseHelper.getCourse({ action: PEDAGOGY }, { _id: course._id }, loggedUser);

      expect(result).toMatchObject({
        _id: courseId,
        subProgram: {
          isStrictlyELearning: false,
          steps: [{
            activities: [{ }],
            name: 'Développement personnel full stack',
            type: 'e_learning',
            areActivitiesValid: false,
            theoreticalDuration: 'PT1800S',
          },
          {
            activities: [],
            name: 'Développer des équipes agiles et autonomes',
            type: 'on_site',
            areActivitiesValid: true,
            theoreticalDuration: 'PT12600S',
          },
          ],
        },
        slots: [{ startDate: '2020-11-03T09:00:00.000Z', endDate: '2020-11-03T12:00:00.000Z' }],
        tutors: [{ _id: loggedUser._id }],
      });

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: course._id }] },
          {
            query: 'populate',
            args: [{
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name image description learningGoals' },
                {
                  path: 'steps',
                  select: 'name type activities theoreticalDuration',
                  populate: {
                    path: 'activities',
                    select: 'name type cards activityHistories',
                    populate: [
                      { path: 'activityHistories', match: { user: loggedUser._id } },
                      { path: 'cards', select: 'template' },
                    ],
                  },
                },
              ],
            }],
          },
          {
            query: 'populate',
            args: [
              {
                path: 'slots',
                select: 'startDate endDate step address meetingLink',
                populate: { path: 'step', select: 'type' },
                options: { sort: { startDate: 1 } },
              },
            ],
          },
          {
            query: 'populate',
            args: [{ path: 'trainers', select: 'identity.firstname identity.lastname biography picture' }],
          },
          { query: 'populate', args: [{ path: 'tutors', select: 'identity.firstname identity.lastname picture' }] },
          {
            query: 'populate',
            args: [{ path: 'contact', select: 'identity.firstname identity.lastname contact.phone local.email' }],
          },
          {
            query: 'populate',
            args: [{
              path: 'attendanceSheets',
              match: { trainee: loggedUser._id },
              options: { requestingOwnInfos: true },
              populate: [{ path: 'slots', select: 'startDate endDate step' }, { path: 'trainer', select: 'identity' }],
            }],
          },
          { query: 'select', args: ['_id misc format'] },
          { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
        ]
      );

      sinon.assert.notCalled(formatCourseWithProgress);
      sinon.assert.notCalled(attendanceCountDocuments);
    });
  });

  describe('QUESTIONNAIRE', () => {
    it('should return blended course', async () => {
      const course = {
        _id: new ObjectId(),
        subProgram: { program: { name: 'Savoir évoluer en équipe autonome' } },
        trainers: [{ identity: { firstname: 'super', lastname: 'formateur' } }],
        trainees: [
          { identity: { firstname: 'titi', lastname: 'grosminet' }, local: { email: 'titi@compa.fr' } },
          { identity: { firstname: 'asterix', lastname: 'obelix' }, local: { email: 'aasterix@compa.fr' } },
        ],
      };

      findOne.returns(SinonMongoose.stubChainedQueries(course));

      const result = await CourseHelper.getCourse({ action: QUESTIONNAIRE }, { _id: course._id });

      expect(result).toMatchObject(course);

      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          {
            query: 'findOne',
            args: [{ _id: course._id }, { subProgram: 1, type: 1, trainers: 1, trainees: 1, misc: 1 }],
          },
          {
            query: 'populate',
            args: [{ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] }],
          },
          {
            query: 'populate',
            args: [{ path: 'trainers', select: 'identity.firstname identity.lastname' }],
          },
          {
            query: 'populate',
            args: [{ path: 'trainees', select: 'identity.firstname identity.lastname local.email' }],
          },
          { query: 'lean', args: [{ virtuals: true }] },
        ]
      );
    });
  });
});

describe('selectUserHistory', () => {
  it('should return only the last history for each user', () => {
    const user1 = new ObjectId();
    const user2 = new ObjectId();
    const histories = [
      { user: user2.toHexString(), createdAt: '2020-10-03T10:00:00' },
      { user: user1.toHexString(), createdAt: '2020-09-03T10:00:00' },
      { user: user2.toHexString(), createdAt: '2020-08-03T10:00:00' },
      { user: user1.toHexString(), createdAt: '2020-11-03T10:00:00' },
      { user: user2.toHexString(), createdAt: '2020-01-03T10:00:00' },
      { user: user2.toHexString(), createdAt: '2020-02-03T10:00:00' },
    ];

    const result = CourseHelper.selectUserHistory(histories);

    expect(result).toStrictEqual([
      { user: user2.toHexString(), createdAt: '2020-10-03T10:00:00' },
      { user: user1.toHexString(), createdAt: '2020-11-03T10:00:00' },
    ]);
  });
});

describe('formatActivity', () => {
  let selectUserHistory;
  beforeEach(() => {
    selectUserHistory = sinon.stub(CourseHelper, 'selectUserHistory');
  });
  afterEach(() => {
    selectUserHistory.restore();
  });

  it('should return empty follow up if no history', () => {
    const activity = { activityHistories: [] };
    selectUserHistory.returns(activity.activityHistories);
    const result = CourseHelper.formatActivity(activity);

    expect(result).toEqual({ activityHistories: [], followUp: [] });
  });

  it('should return format activity with histories', () => {
    const userIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const historyIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const activity = {
      activityHistories: [
        {
          _id: historyIds[0],
          user: userIds[0],
          questionnaireAnswersList: [
            { card: { _id: '1234567', title: 'Bonjour' }, answerList: ['2'] },
            { card: { _id: '0987654', title: 'Hello' }, answerList: ['3'] },
          ],
        },
        {
          _id: historyIds[1],
          user: userIds[1],
          questionnaireAnswersList: [
            { card: { _id: '1234567', title: 'Bonjour' }, answerList: ['3'] },
            { card: { _id: '0987654', title: 'Hello' }, answerList: ['', '4'] },
          ],
        },
        {
          _id: historyIds[2],
          user: userIds[2],
          questionnaireAnswersList: [
            { card: { _id: '1234567', title: 'Bonjour' }, answerList: ['1'] },
            { card: { _id: '0987654', title: 'Hello' }, answerList: ['4'] },
            { card: { _id: '0987622', title: 'Coucou' }, answerList: [''] },
          ],
        },
      ],
    };
    selectUserHistory.returns(activity.activityHistories);
    const result = CourseHelper.formatActivity(activity);

    expect(result).toEqual({
      activityHistories: historyIds,
      followUp: [
        {
          _id: '1234567',
          title: 'Bonjour',
          answers: [
            { answer: '2', trainee: userIds[0], history: historyIds[0] },
            { answer: '3', trainee: userIds[1], history: historyIds[1] },
            { answer: '1', trainee: userIds[2], history: historyIds[2] },

          ],
        },
        {
          _id: '0987654',
          title: 'Hello',
          answers: [
            { answer: '3', trainee: userIds[0], history: historyIds[0] },
            { answer: '', trainee: userIds[1], history: historyIds[1] },
            { answer: '4', trainee: userIds[1], history: historyIds[1] },
            { answer: '4', trainee: userIds[2], history: historyIds[2] },
          ],
        },
      ],
    });
  });
});

describe('formatStep', () => {
  let formatActivity;
  beforeEach(() => {
    formatActivity = sinon.stub(CourseHelper, 'formatActivity');
  });
  afterEach(() => {
    formatActivity.restore();
  });

  it('should format step', () => {
    const step = { name: 'Je suis une etape', activities: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] };
    formatActivity.callsFake(a => a._id);
    const result = CourseHelper.formatStep(step);

    expect(result).toEqual({ name: 'Je suis une etape', activities: ['abc', 'def', 'ghi'] });
  });
});

describe('getCourseFollowUp', () => {
  let findOne;
  let formatStep;
  let getTraineesWithElearningProgress;
  let getCompanyAtCourseRegistrationList;
  beforeEach(() => {
    findOne = sinon.stub(Course, 'findOne');
    formatStep = sinon.stub(CourseHelper, 'formatStep');
    getTraineesWithElearningProgress = sinon.stub(CourseHelper, 'getTraineesWithElearningProgress');
    getCompanyAtCourseRegistrationList = sinon
      .stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
  });
  afterEach(() => {
    findOne.restore();
    formatStep.restore();
    getTraineesWithElearningProgress.restore();
    getCompanyAtCourseRegistrationList.restore();
  });

  it('should return course follow up', async () => {
    const credentials = { role: { vendor: { _id: new ObjectId() } } };
    const companyId = new ObjectId();
    const course = {
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [
        { _id: '123213123', identity: { firstname: 'papi', lastname: 'Jojo' }, loginCode: '1234' },
        {
          _id: '123213124',
          identity: { firstname: 'mamie', lastname: 'Francine' },
          firstMobileConnectionDate: '2022-11-18T10:20:00.000Z',
        },

      ],
    };
    const trainees = [1, 2, 3, 4, 5];

    findOne.onCall(0).returns(SinonMongoose.stubChainedQueries({ trainees, format: BLENDED }, ['lean']));
    findOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));

    formatStep.callsFake(s => s);
    getTraineesWithElearningProgress.returns([
      {
        _id: '123213123',
        identity: { firstname: 'papi', lastname: 'Jojo' },
        loginCode: '1234',
        steps: { progress: 1 },
        progress: 1,
        company: companyId,
      },
      {
        _id: '123213124',
        identity: { firstname: 'mamie', lastname: 'Francine' },
        firstMobileConnectionDate: '2022-11-18T10:20:00.000Z',
        steps: { progress: 1 },
        progress: 1,
        company: companyId,
      },
    ]);
    const result = await CourseHelper.getCourseFollowUp(course._id, {}, credentials);

    expect(result).toEqual({
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [
        {
          _id: '123213123',
          identity: { firstname: 'papi', lastname: 'Jojo' },
          loginCode: '1234',
          company: companyId,
          steps: { progress: 1 },
          progress: 1,
        },
        {
          _id: '123213124',
          identity: { firstname: 'mamie', lastname: 'Francine' },
          firstMobileConnectionDate: '2022-11-18T10:20:00.000Z',
          company: companyId,
          steps: { progress: 1 },
          progress: 1,
        },
      ],
    });

    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: course._id }, { trainees: 1, format: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { subProgram: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'name steps program',
            populate: [
              { path: 'program', select: 'name' },
              {
                path: 'steps',
                select: 'name activities type',
                populate: {
                  path: 'activities',
                  select: 'name type',
                  populate: {
                    path: 'activityHistories',
                    match: { user: { $in: trainees } },
                    populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
                  },
                },
              },
            ],
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'trainees',
            select: 'identity.firstname identity.lastname firstMobileConnectionDate loginCode',
            populate: { path: 'company' },
          }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.calledOnceWithExactly(getTraineesWithElearningProgress, course.trainees, course.subProgram.steps);
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
  });

  it('should return blended course follow up from company', async () => {
    const companyId = new ObjectId();
    const credentials = { role: { client: { _id: new ObjectId() } }, company: companyId };
    const course = {
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [{ _id: '123213123' }, { _id: '123213342' }],
      slots: [{ _id: '123456789' }],
    };
    const trainees = [1, 2, 3, 4, 5];

    findOne.onCall(0).returns(SinonMongoose.stubChainedQueries({ trainees, format: BLENDED }, ['lean']));
    findOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    formatStep.callsFake(s => s);
    getTraineesWithElearningProgress.returns([
      { _id: '123213123', steps: { progress: 1 }, progress: 1, company: companyId },
    ]);
    getCompanyAtCourseRegistrationList.returns(
      [{ trainee: '123213123', company: companyId }, { trainee: '123213342', company: new ObjectId() }]
    );

    const result = await CourseHelper.getCourseFollowUp(course._id, { company: companyId }, credentials);

    expect(result).toEqual({
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [{ _id: '123213123', steps: { progress: 1 }, progress: 1, company: companyId }],
      slots: [{ _id: '123456789' }],
    });

    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: course._id }, { trainees: 1, format: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { subProgram: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'name steps program',
            populate: [
              { path: 'program', select: 'name' },
              {
                path: 'steps',
                select: 'name activities type',
                populate: {
                  path: 'activities',
                  select: 'name type',
                  populate: {
                    path: 'activityHistories',
                    match: { user: { $in: trainees } },
                    populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
                  },
                },
              },
            ],
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'trainees',
            select: 'identity.firstname identity.lastname firstMobileConnectionDate loginCode',
            populate: { path: 'company' },
          }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.calledOnceWithExactly(getTraineesWithElearningProgress, [course.trainees[0]], course.subProgram.steps);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      { key: TRAINEE, value: ['123213123', '123213342'] }
    );
  });

  it('should return blended course follow up from holding', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const holdingId = new ObjectId();
    const credentials = {
      role: { holding: { _id: new ObjectId() } },
      holding: { _id: holdingId, companies: [companyId, otherCompanyId] },
    };

    const course = {
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [{ _id: '123213123' }, { _id: '123213342' }, { _id: '123213346' }],
      slots: [{ _id: '123456789' }],
    };
    const trainees = [1, 2, 3, 4, 5];

    findOne.onCall(0).returns(SinonMongoose.stubChainedQueries({ trainees, format: BLENDED }, ['lean']));
    findOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    formatStep.callsFake(s => s);
    getTraineesWithElearningProgress.returns([
      { _id: '123213123', steps: { progress: 1 }, progress: 1, company: companyId },
      { _id: '123213346', steps: { progress: 1 }, progress: 1, company: otherCompanyId },
    ]);
    getCompanyAtCourseRegistrationList.returns(
      [
        { trainee: '123213123', company: companyId },
        { trainee: '123213342', company: new ObjectId() },
        { trainee: '123213346', company: otherCompanyId },
      ]
    );

    const result = await CourseHelper.getCourseFollowUp(course._id, { holding: holdingId }, credentials);

    expect(result).toEqual({
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [
        { _id: '123213123', steps: { progress: 1 }, progress: 1, company: companyId },
        { _id: '123213346', steps: { progress: 1 }, progress: 1, company: otherCompanyId },
      ],
      slots: [{ _id: '123456789' }],
    });

    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: course._id }, { trainees: 1, format: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { subProgram: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'name steps program',
            populate: [
              { path: 'program', select: 'name' },
              {
                path: 'steps',
                select: 'name activities type',
                populate: {
                  path: 'activities',
                  select: 'name type',
                  populate: {
                    path: 'activityHistories',
                    match: { user: { $in: trainees } },
                    populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
                  },
                },
              },
            ],
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'trainees',
            select: 'identity.firstname identity.lastname firstMobileConnectionDate loginCode',
            populate: { path: 'company' },
          }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.calledOnceWithExactly(
      getTraineesWithElearningProgress,
      [course.trainees[0], course.trainees[2]],
      course.subProgram.steps
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      { key: TRAINEE, value: ['123213123', '123213342', '123213346'] }
    );
  });

  it('should return elearning course follow up from company', async () => {
    const companyId = new ObjectId();
    const credentials = { role: { client: { _id: new ObjectId() } }, company: companyId };
    const course = {
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [{ _id: '123213123', company: companyId }, { _id: '123213342', company: new ObjectId() }],
    };
    const trainees = [1, 2, 3, 4, 5];

    findOne.onCall(0).returns(SinonMongoose.stubChainedQueries({ trainees, format: STRICTLY_E_LEARNING }, ['lean']));
    findOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    formatStep.callsFake(s => s);
    getTraineesWithElearningProgress.returns([
      { _id: '123213123', steps: { progress: 1 }, progress: 1, company: companyId },
    ]);

    const result = await CourseHelper.getCourseFollowUp(course._id, { company: companyId }, credentials);

    expect(result).toEqual({
      _id: '1234567890',
      subProgram: { name: 'je suis un sous programme', steps: [{ _id: 'abc' }, { _id: 'def' }, { _id: 'ghi' }] },
      trainees: [{ _id: '123213123', steps: { progress: 1 }, progress: 1, company: companyId }],
    });

    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ _id: course._id }, { trainees: 1, format: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { subProgram: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'name steps program',
            populate: [
              { path: 'program', select: 'name' },
              {
                path: 'steps',
                select: 'name activities type',
                populate: {
                  path: 'activities',
                  select: 'name type',
                  populate: {
                    path: 'activityHistories',
                    match: { user: { $in: trainees } },
                    populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
                  },
                },
              },
            ],
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'trainees',
            select: 'identity.firstname identity.lastname firstMobileConnectionDate loginCode',
            populate: { path: 'company' },
          }],
        },
        { query: 'lean' },
      ],
      1
    );
    sinon.assert.calledOnceWithExactly(getTraineesWithElearningProgress, [course.trainees[0]], course.subProgram.steps);
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
  });
});

describe('getQuestionnaireAnswers', () => {
  let findOneCourse;
  let formatActivity;
  beforeEach(() => {
    findOneCourse = sinon.stub(Course, 'findOne');
    formatActivity = sinon.stub(CourseHelper, 'formatActivity');
  });
  afterEach(() => {
    findOneCourse.restore();
    formatActivity.restore();
  });

  it('should return questionnaire answers', async () => {
    const courseId = new ObjectId();
    const userId = new ObjectId();
    const activities = [
      { activityHistories: [{ _id: new ObjectId(), user: userId, questionnaireAnswersList: { card: {} } }] },
      { activityHistories: [{ _id: new ObjectId(), user: userId, questionnaireAnswersList: { card: {} } }] },
    ];

    const followUps = [
      { question: 'test', answers: ['1', '2'] },
      { question: 'test2', answers: ['3', '4'] },
    ];

    const course = {
      _id: courseId,
      misc: 'Groupe 3',
      trainees: [userId],
      subProgram: {
        steps: [
          { _id: new ObjectId(), program: { name: 'nom du programme' }, activities: [activities[0]] },
          { _id: new ObjectId(), program: { name: 'nom du programme' }, activities: [activities[1]] },
        ],
      },
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    formatActivity.onCall(0).returns({ followUp: [followUps[0]] });
    formatActivity.onCall(1).returns({ followUp: [followUps[1]] });

    const result = await CourseHelper.getQuestionnaireAnswers(courseId);

    expect(result).toMatchObject(followUps);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'steps',
            populate: [{
              path: 'steps',
              select: 'activities',
              populate: {
                path: 'activities',
                populate: {
                  path: 'activityHistories',
                  populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
                },
              },
            }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(formatActivity.getCall(0), activities[0]);
    sinon.assert.calledWithExactly(formatActivity.getCall(1), activities[1]);
  });

  it('should return [] if no followUp', async () => {
    const courseId = new ObjectId();
    const userId = new ObjectId();
    const activities = [{ activityHistories: [] }, { activityHistories: [] }];

    const course = {
      _id: courseId,
      misc: 'Groupe 3',
      trainees: [userId],
      subProgram: {
        steps: [
          { _id: new ObjectId(), program: { name: 'nom du programme' }, activities: [activities[0]] },
          { _id: new ObjectId(), program: { name: 'nom du programme' }, activities: [activities[1]] },
        ],
      },
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    formatActivity.onCall(0).returns({ followUp: [] });
    formatActivity.onCall(1).returns({ followUp: [] });

    const result = await CourseHelper.getQuestionnaireAnswers(courseId);

    expect(result).toMatchObject([]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'steps',
            populate: [{
              path: 'steps',
              select: 'activities',
              populate: {
                path: 'activities',
                populate: {
                  path: 'activityHistories',
                  populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
                },
              },
            }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(formatActivity.getCall(0), activities[0]);
    sinon.assert.calledWithExactly(formatActivity.getCall(1), activities[1]);
  });

  it('should return [] if no step', async () => {
    const courseId = new ObjectId();
    const userId = new ObjectId();

    const course = {
      _id: courseId,
      misc: 'Groupe 3',
      trainees: [userId],
      subProgram: {},
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));

    const result = await CourseHelper.getQuestionnaireAnswers(courseId);

    expect(result).toMatchObject([]);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'steps',
            populate: [{
              path: 'steps',
              select: 'activities',
              populate: {
                path: 'activities',
                populate: {
                  path: 'activityHistories',
                  populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
                },
              },
            }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(formatActivity);
  });
});

describe('getTraineesWithElearningProgress', () => {
  let getProgress;
  let getCourseProgress;
  beforeEach(() => {
    getProgress = sinon.stub(StepsHelper, 'getProgress');
    getCourseProgress = sinon.stub(CourseHelper, 'getCourseProgress');
  });
  afterEach(() => {
    getProgress.restore();
    getCourseProgress.restore();
  });

  it('should return formatted steps and course progress', () => {
    const traineeId = new ObjectId();
    const otherTraineeId = new ObjectId();
    const steps = [
      {
        activities: [{ activityHistories: [{ user: traineeId }, { user: otherTraineeId }] }],
        type: ON_SITE,
      },
      {
        activities: [{ activityHistories: [{ user: traineeId }, { user: otherTraineeId }] }],
        type: E_LEARNING,
      },
    ];

    const formattedSteps = [{
      activities: [{ activityHistories: [{ user: traineeId }] }],
      type: E_LEARNING,
      progress: 1,
    }];

    getProgress.returns(1);
    getCourseProgress.returns(1);

    const result = CourseHelper.getTraineesWithElearningProgress([{ _id: traineeId }], steps);

    expect(result).toEqual([
      {
        _id: traineeId,
        steps: [{ activities: [{ activityHistories: [{ user: traineeId }] }], type: E_LEARNING, progress: 1 }],
        progress: 1,
      },
    ]);
    sinon.assert.calledOnceWithExactly(
      getProgress,
      { activities: [{ activityHistories: [{ user: traineeId }] }], type: E_LEARNING }
    );
    sinon.assert.calledOnceWithExactly(getCourseProgress, formattedSteps);
  });
});

describe('updateCourse', () => {
  let courseFindOneAndUpdate;
  let createHistoryOnEstimatedStartDateEdition;
  const credentials = { _id: new ObjectId() };
  beforeEach(() => {
    courseFindOneAndUpdate = sinon.stub(Course, 'findOneAndUpdate');
    createHistoryOnEstimatedStartDateEdition = sinon.stub(
      CourseHistoriesHelper,
      'createHistoryOnEstimatedStartDateEdition'
    );
  });
  afterEach(() => {
    courseFindOneAndUpdate.restore();
    createHistoryOnEstimatedStartDateEdition.restore();
  });

  it('should update a field in intra course', async () => {
    const courseId = new ObjectId();
    const payload = { misc: 'groupe 4' };
    const courseFromDb = { _id: courseId, misc: '' };

    courseFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseFromDb, ['lean']));

    await CourseHelper.updateCourse(courseId, payload, credentials);

    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    SinonMongoose.calledOnceWithExactly(
      courseFindOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: courseId }, { $set: payload }] },
        { query: 'lean' },
      ]
    );
  });

  it('should remove contact field in intra course', async () => {
    const courseId = new ObjectId();
    const operationsRepresentative = new ObjectId();
    const payload = { contact: '', operationsRepresentative };
    const courseFromDb = { _id: courseId, contact: operationsRepresentative, operationsRepresentative };

    courseFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseFromDb, ['lean']));

    await CourseHelper.updateCourse(courseId, payload, credentials);

    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    SinonMongoose.calledOnceWithExactly(
      courseFindOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ _id: courseId }, { $set: { operationsRepresentative }, $unset: { contact: '' } }],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should remove certified trainees', async () => {
    const courseId = new ObjectId();
    const payload = { certifiedTrainees: [] };
    const courseFromDb = { _id: courseId, hasCertifyingTest: true, certifiedTrainees: [new ObjectId()] };

    courseFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseFromDb, ['lean']));

    await CourseHelper.updateCourse(courseId, payload, credentials);

    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    SinonMongoose.calledOnceWithExactly(
      courseFindOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ _id: courseId }, { $unset: { certifiedTrainees: '' } }],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should unarchive course', async () => {
    const courseId = new ObjectId();
    const payload = { archivedAt: '' };
    const courseFromDb = { _id: courseId, archivedAt: '2022-11-18T10:20:00.000Z' };

    courseFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseFromDb, ['lean']));

    await CourseHelper.updateCourse(courseId, payload, credentials);

    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    SinonMongoose.calledOnceWithExactly(
      courseFindOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ _id: courseId }, { $unset: { archivedAt: '' } }],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should update estimatedStartDate and create history', async () => {
    const courseId = new ObjectId();
    const payload = { estimatedStartDate: '2022-11-18T10:20:00.000Z' };
    const courseFromDb = { _id: courseId, estimatedStartDate: '2022-11-02T18:00:43.000Z' };

    courseFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseFromDb, ['lean']));

    await CourseHelper.updateCourse(courseId, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseFindOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ _id: courseId }, { $set: { estimatedStartDate: '2022-11-18T10:20:00.000Z' } }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      createHistoryOnEstimatedStartDateEdition,
      courseId,
      credentials._id,
      '2022-11-18T10:20:00.000Z',
      '2022-11-02T18:00:43.000Z'
    );
  });

  it('should update estimatedStartDate with same value and NOT create history', async () => {
    const courseId = new ObjectId();
    const payload = { estimatedStartDate: '2022-11-18T10:20:00.000Z' };
    const courseFromDb = { _id: courseId, estimatedStartDate: '2022-11-18T10:20:00.000Z' };

    courseFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseFromDb, ['lean']));

    await CourseHelper.updateCourse(courseId, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseFindOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ _id: courseId }, { $set: { estimatedStartDate: '2022-11-18T10:20:00.000Z' } }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
  });

  it('should remove salesRepresentative field', async () => {
    const courseId = new ObjectId();
    const payload = { salesRepresentative: '' };
    const courseFromDb = { _id: courseId, salesRepresentative: new ObjectId() };

    courseFindOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseFromDb, ['lean']));

    await CourseHelper.updateCourse(courseId, payload, credentials);

    sinon.assert.notCalled(createHistoryOnEstimatedStartDateEdition);
    SinonMongoose.calledOnceWithExactly(
      courseFindOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [{ _id: courseId }, { $unset: { salesRepresentative: '' } }],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('deleteCourse', () => {
  let deleteCourse;
  let deleteCourseBill;
  let deleteCourseSmsHistory;
  let deleteCourseHistory;
  let deleteCourseSlot;
  let deleteQuestionnaireHistory;
  let findTrainingContract;
  let deleteManyTrainingContract;
  beforeEach(() => {
    deleteCourse = sinon.stub(Course, 'deleteOne');
    deleteCourseBill = sinon.stub(CourseBill, 'deleteMany');
    deleteCourseSmsHistory = sinon.stub(CourseSmsHistory, 'deleteMany');
    deleteCourseHistory = sinon.stub(CourseHistory, 'deleteMany');
    deleteCourseSlot = sinon.stub(CourseSlot, 'deleteMany');
    deleteQuestionnaireHistory = sinon.stub(QuestionnaireHistory, 'deleteMany');
    findTrainingContract = sinon.stub(TrainingContract, 'find');
    deleteManyTrainingContract = sinon.stub(TrainingContractsHelper, 'deleteMany');
  });
  afterEach(() => {
    deleteCourse.restore();
    deleteCourseBill.restore();
    deleteCourseSmsHistory.restore();
    deleteCourseHistory.restore();
    deleteCourseSlot.restore();
    deleteQuestionnaireHistory.restore();
    findTrainingContract.restore();
    deleteManyTrainingContract.restore();
  });

  it('should delete course and sms history', async () => {
    const courseId = new ObjectId();
    const trainingContractList = [{ _id: new ObjectId() }, { _id: new ObjectId() }];

    findTrainingContract.returns(SinonMongoose.stubChainedQueries(trainingContractList, ['setOptions', 'lean']));

    await CourseHelper.deleteCourse(courseId);

    sinon.assert.calledOnceWithExactly(deleteCourse, { _id: courseId });
    sinon.assert.calledOnceWithExactly(
      deleteCourseBill,
      { course: courseId, $or: [{ billedAt: { $exists: false } }, { billedAt: { $not: { $type: 'date' } } }] }
    );
    sinon.assert.calledOnceWithExactly(deleteCourseSmsHistory, { course: courseId });
    sinon.assert.calledOnceWithExactly(deleteCourseHistory, { course: courseId });
    sinon.assert.calledOnceWithExactly(deleteCourseSlot, { course: courseId });
    sinon.assert.calledOnceWithExactly(deleteQuestionnaireHistory, { course: courseId });
    sinon.assert.calledOnceWithExactly(deleteManyTrainingContract, trainingContractList.map(tc => tc._id));
    SinonMongoose.calledOnceWithExactly(
      findTrainingContract,
      [
        { query: 'find', args: [{ course: courseId }, { _id: 1 }] },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('sendSMS', () => {
  const courseId = new ObjectId();
  const trainees = [
    { contact: { phone: '0123456789' }, identity: { firstname: 'non', lasname: 'ok' }, _id: 'qwertyuio' },
    { contact: { phone: '0987654321' }, identity: { firstname: 'test', lasname: 'ok' }, _id: 'asdfghjkl' },
    { contact: {}, identity: { firstname: 'test', lasname: 'ko' }, _id: 'poiuytrewq' },
  ];
  const payload = { content: 'Ceci est un test.' };
  const credentials = { _id: new ObjectId() };

  let courseFindById;
  let courseSmsHistoryCreate;
  let sendStub;
  beforeEach(() => {
    courseFindById = sinon.stub(Course, 'findById');
    courseSmsHistoryCreate = sinon.stub(CourseSmsHistory, 'create');
    sendStub = sinon.stub(SmsHelper, 'send');
  });
  afterEach(() => {
    courseFindById.restore();
    courseSmsHistoryCreate.restore();
    sendStub.restore();
  });

  it('should send SMS to trainees and save missing phone trainee id', async () => {
    courseFindById.returns(SinonMongoose.stubChainedQueries({ trainees }));
    sendStub.onCall(0).returns();
    sendStub.onCall(1).returns(new Promise(() => { throw Boom.badRequest(); }));

    await CourseHelper.sendSMS(courseId, payload, credentials);

    SinonMongoose.calledOnceWithExactly(
      courseFindById,
      [
        { query: 'findById', args: [courseId] },
        { query: 'populate', args: [{ path: 'trainees', select: '_id contact' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      courseSmsHistoryCreate,
      {
        type: payload.type,
        course: courseId,
        message: payload.content,
        sender: credentials._id,
        missingPhones: ['poiuytrewq'],
      }
    );
    sinon.assert.calledWith(
      sendStub.getCall(0),
      {
        recipient: `+33${trainees[0].contact.phone.substring(1)}`,
        sender: 'Compani',
        content: payload.content,
        tag: COURSE_SMS,
      }
    );
    sinon.assert.calledWithExactly(
      sendStub.getCall(1),
      {
        recipient: `+33${trainees[1].contact.phone.substring(1)}`,
        sender: 'Compani',
        content: payload.content,
        tag: COURSE_SMS,
      }
    );
  });

  it('should not save coursesmshistory if no sms is sent', async () => {
    try {
      courseFindById.returns(SinonMongoose.stubChainedQueries({ trainees }));
      sendStub.returns(new Promise(() => { throw Boom.badRequest(); }));

      await CourseHelper.sendSMS(courseId, payload, credentials);

      expect(false).toBe(true);
    } catch (e) {
      sinon.assert.notCalled(courseSmsHistoryCreate);
      expect(e).toEqual(Boom.badRequest());
    }
  });

  it('should do nothing if no phone numbers', async () => {
    const traineesWithoutPhoneNumbers = [
      { contact: {}, identity: { firstname: 'non', lasname: 'ok' }, _id: 'qwertyuio' },
      { contact: {}, identity: { firstname: 'test', lasname: 'ok' }, _id: 'asdfghjkl' },
      { contact: {}, identity: { firstname: 'test', lasname: 'ko' }, _id: 'poiuytrewq' },
    ];

    courseFindById.returns(SinonMongoose.stubChainedQueries({ trainees: traineesWithoutPhoneNumbers }));

    await CourseHelper.sendSMS(courseId, payload, credentials);

    sinon.assert.notCalled(sendStub);
    sinon.assert.notCalled(courseSmsHistoryCreate);
  });
});

describe('getSMSHistory', () => {
  const courseId = new ObjectId();
  const sms = [{ type: 'convocation', message: 'Hello, this is a test' }];
  let courseSmsHistoryFind;
  beforeEach(() => {
    courseSmsHistoryFind = sinon.stub(CourseSmsHistory, 'find');
  });
  afterEach(() => {
    courseSmsHistoryFind.restore();
  });

  it('should get SMS history', async () => {
    courseSmsHistoryFind.returns(SinonMongoose.stubChainedQueries(sms));

    const result = await CourseHelper.getSMSHistory(courseId);

    expect(result).toEqual(sms);
    SinonMongoose.calledOnceWithExactly(
      courseSmsHistoryFind,
      [
        { query: 'find', args: [{ course: courseId }] },
        { query: 'populate', args: [{ path: 'sender', select: 'identity.firstname identity.lastname' }] },
        { query: 'populate', args: [{ path: 'missingPhones', select: 'identity.firstname identity.lastname' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('addTrainee', () => {
  let courseFindOneAndUpdate;
  let userFindOne;
  let userUpdateOne;
  let createHistoryOnTraineeAddition;
  let sendBlendedCourseRegistrationNotification;
  beforeEach(() => {
    courseFindOneAndUpdate = sinon.stub(Course, 'findOneAndUpdate');
    userFindOne = sinon.stub(User, 'findOne');
    userUpdateOne = sinon.stub(User, 'updateOne');
    createHistoryOnTraineeAddition = sinon.stub(CourseHistoriesHelper, 'createHistoryOnTraineeAddition');
    sendBlendedCourseRegistrationNotification = sinon.stub(
      NotificationHelper,
      'sendBlendedCourseRegistrationNotification'
    );
  });
  afterEach(() => {
    courseFindOneAndUpdate.restore();
    userFindOne.restore();
    userUpdateOne.restore();
    createHistoryOnTraineeAddition.restore();
    sendBlendedCourseRegistrationNotification.restore();
  });

  it('should register an existing user who is connected to the mobile app (INTER course)', async () => {
    const user = {
      _id: new ObjectId(),
      formationExpoTokenList: 'ExponentPushToken[bla]',
      firstMobileConnectionDate: '2022-01-21T12:00:00.000Z',
    };
    const course = { _id: new ObjectId(), misc: 'Test', type: INTER_B2B };
    const payload = { trainee: user._id, company: new ObjectId(), isCertified: true };
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };

    userFindOne.returns(user);
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    courseFindOneAndUpdate.returns(course);

    await CourseHelper.addTrainee(course._id, payload, credentials);

    sinon.assert.calledOnceWithExactly(
      courseFindOneAndUpdate,
      { _id: course._id },
      { $addToSet: { trainees: user._id, certifiedTrainees: user._id } },
      { projection: { companies: 1, type: 1 } }
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        {
          query: 'findOne',
          args: [{ _id: user._id }, { formationExpoTokenList: 1, firstMobileConnectionDate: 1, loginCode: 1 }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      createHistoryOnTraineeAddition,
      { course: course._id, traineeId: user._id, company: payload.company },
      credentials._id
    );
    sinon.assert.calledOnceWithExactly(sendBlendedCourseRegistrationNotification, user, course._id);
    sinon.assert.notCalled(userUpdateOne);
  });

  it('should register an existing user who has already registered for a course and is NOT connected to the'
    + 'mobile app (INTER course)', async () => {
    const user = {
      _id: new ObjectId(),
      formationExpoTokenList: 'ExponentPushToken[bla]',
      loginCode: '6789',
    };
    const course = { _id: new ObjectId(), misc: 'Test', type: INTER_B2B };
    const payload = { trainee: user._id, company: new ObjectId() };
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };

    userFindOne.returns(user);
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    courseFindOneAndUpdate.returns(course);

    await CourseHelper.addTrainee(course._id, payload, credentials);

    sinon.assert.calledOnceWithExactly(
      courseFindOneAndUpdate,
      { _id: course._id },
      { $addToSet: { trainees: user._id } },
      { projection: { companies: 1, type: 1 } }
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        {
          query: 'findOne',
          args: [{ _id: user._id }, { formationExpoTokenList: 1, firstMobileConnectionDate: 1, loginCode: 1 }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      createHistoryOnTraineeAddition,
      { course: course._id, traineeId: user._id, company: payload.company },
      credentials._id
    );
    sinon.assert.calledOnceWithExactly(sendBlendedCourseRegistrationNotification, user, course._id);
    sinon.assert.notCalled(userUpdateOne);
  });

  it('should register an existing user to course (INTRA) and create loginCode in db', async () => {
    const user = { _id: new ObjectId(), formationExpoTokenList: 'ExponentPushToken[bla]' };
    const course = { _id: new ObjectId(), misc: 'Test', type: INTRA, companies: [new ObjectId()] };
    const payload = { trainee: user._id };
    const credentials = { _id: new ObjectId(), company: { _id: new ObjectId() } };

    userFindOne.returns(user);
    userFindOne.returns(SinonMongoose.stubChainedQueries(user, ['lean']));
    courseFindOneAndUpdate.returns(course);

    await CourseHelper.addTrainee(course._id, payload, credentials);

    sinon.assert.calledOnceWithExactly(
      courseFindOneAndUpdate,
      { _id: course._id },
      { $addToSet: { trainees: user._id } },
      { projection: { companies: 1, type: 1 } }
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        {
          query: 'findOne',
          args: [{ _id: user._id }, { formationExpoTokenList: 1, firstMobileConnectionDate: 1, loginCode: 1 }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnce(userUpdateOne);
    sinon.assert.calledOnceWithExactly(
      createHistoryOnTraineeAddition,
      { course: course._id, traineeId: user._id, company: course.companies[0] },
      credentials._id
    );
    sinon.assert.calledOnceWithExactly(sendBlendedCourseRegistrationNotification, user, course._id);
  });
});

describe('registerToELearningCourse', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should add a course trainee using existing user', async () => {
    const courseId = new ObjectId();
    const credentials = { _id: new ObjectId() };
    await CourseHelper.registerToELearningCourse(courseId, credentials);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: courseId }, { $addToSet: { trainees: credentials._id } });
  });
});

describe('removeCourseTrainee', () => {
  let updateOne;
  let createHistoryOnTraineeDeletion;
  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
    createHistoryOnTraineeDeletion = sinon.stub(CourseHistoriesHelper, 'createHistoryOnTraineeDeletion');
  });
  afterEach(() => {
    updateOne.restore();
    createHistoryOnTraineeDeletion.restore();
  });

  it('should remove a course trainee', async () => {
    const course = new ObjectId();
    const traineeId = new ObjectId();
    const removedBy = { _id: new ObjectId() };

    await CourseHelper.removeCourseTrainee(course, traineeId, removedBy);
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: course },
      { $pull: { trainees: traineeId, certifiedTrainees: traineeId } }
    );
    sinon.assert.calledOnceWithExactly(createHistoryOnTraineeDeletion, { course, traineeId }, removedBy._id);
  });
});

describe('formatInterCourseSlotsForPdf', () => {
  it('should format slot for pdf', () => {
    const slot = {
      startDate: '2020-03-20T09:00:00',
      endDate: '2020-03-20T11:00:00',
      address: { fullAddress: 'je suis une adress' },
    };

    const result = CourseHelper.formatInterCourseSlotsForPdf(slot);

    expect(result).toEqual({
      address: 'je suis une adress',
      date: '20/03/2020',
      startHour: '09:00',
      endHour: '11:00',
      duration: '2h',
    });
  });
});

describe('groupSlotsByDate', () => {
  it('should group slots by date', () => {
    const slots = [
      {
        startDate: '2020-03-20T09:00:00',
        endDate: '2020-03-20T11:00:00',
        address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
      },
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
      { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00' },
    ];

    const result = CourseHelper.groupSlotsByDate(slots);

    expect(result).toEqual([
      [{
        startDate: '2020-03-20T09:00:00',
        endDate: '2020-03-20T11:00:00',
        address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
      }], [
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00' },
      ],
    ]);
  });
});

describe('formatIntraCourseForPdf', () => {
  let formatIdentity;
  let getTotalDuration;
  let groupSlotsByDate;
  let formatIntraCourseSlotsForPdf;
  beforeEach(() => {
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    getTotalDuration = sinon.stub(UtilsHelper, 'getTotalDuration');
    groupSlotsByDate = sinon.stub(CourseHelper, 'groupSlotsByDate');
    formatIntraCourseSlotsForPdf = sinon.stub(CourseHelper, 'formatIntraCourseSlotsForPdf');
  });
  afterEach(() => {
    formatIdentity.restore();
    getTotalDuration.restore();
    groupSlotsByDate.restore();
    formatIntraCourseSlotsForPdf.restore();
  });

  it('should format course for pdf (intra)', () => {
    const course = {
      misc: 'des infos en plus',
      trainers: [
        { identity: { lastname: 'MasterClass' } },
        { identity: { lastname: 'MasterCompani' } },
      ],
      subProgram: { program: { name: 'programme' } },
      slots: [
        {
          startDate: '2020-03-20T09:00:00',
          endDate: '2020-03-20T11:00:00',
          address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
          step: { type: 'on_site' },
        },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-14T18:00:00', endDate: '2020-04-14T19:30:00', step: { type: 'remote' } },
      ],
      companies: [{ name: 'alenvi' }],
      type: INTRA,
    };

    getTotalDuration.returns('8h');
    groupSlotsByDate.returns([[{
      startDate: '2020-03-20T09:00:00',
      endDate: '2020-03-20T11:00:00',
      address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
      step: { type: 'on_site' },
    }], [
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
      { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00', step: { type: 'on_site' } },
    ]]);
    formatIntraCourseSlotsForPdf.onCall(0).returns({ startHour: 'slot1' });
    formatIntraCourseSlotsForPdf.onCall(1).returns({ startHour: 'slot2' });
    formatIntraCourseSlotsForPdf.onCall(2).returns({ startHour: 'slot3' });

    const result = CourseHelper.formatIntraCourseForPdf(course);

    expect(result).toEqual({
      dates: [
        {
          course: {
            name: 'programme - des infos en plus',
            duration: '8h',
            company: 'alenvi',
            trainer: '',
            type: INTRA,
          },
          address: '37 rue de Ponthieu 75008 Paris',
          slots: [{ startHour: 'slot1' }],
          date: '20/03/2020',
        },
        {
          course: {
            name: 'programme - des infos en plus',
            duration: '8h',
            company: 'alenvi',
            trainer: '',
            type: INTRA,
          },
          address: '',
          slots: [{ startHour: 'slot2' }, { startHour: 'slot3' }],
          date: '12/04/2020',
        }],
    });
    sinon.assert.calledOnceWithExactly(getTotalDuration, course.slots);
    sinon.assert.notCalled(formatIdentity);
    sinon.assert.calledOnceWithExactly(groupSlotsByDate, [
      {
        startDate: '2020-03-20T09:00:00',
        endDate: '2020-03-20T11:00:00',
        address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
        step: { type: 'on_site' },
      },
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
      { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00', step: { type: 'on_site' } },
    ]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(0), course.slots[0]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(1), course.slots[1]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(2), course.slots[2]);
    sinon.assert.callCount(formatIntraCourseSlotsForPdf, 3);
  });

  it('should format course for pdf (intra_holding)', () => {
    const course = {
      misc: 'des infos en plus',
      trainers: [{ identity: { lastname: 'MasterClass' } }],
      subProgram: { program: { name: 'programme' } },
      slots: [
        {
          startDate: '2020-03-20T09:00:00',
          endDate: '2020-03-20T11:00:00',
          address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
          step: { type: 'on_site' },
        },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-14T18:00:00', endDate: '2020-04-14T19:30:00', step: { type: 'remote' } },
      ],
      companies: [{ name: 'alenvi' }, { name: 'biens communs' }],
      type: INTRA_HOLDING,
    };

    getTotalDuration.returns('8h');
    formatIdentity.returns('MasterClass');
    groupSlotsByDate.returns([[{
      startDate: '2020-03-20T09:00:00',
      endDate: '2020-03-20T11:00:00',
      address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
      step: { type: 'on_site' },
    }], [
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
      { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00', step: { type: 'on_site' } },
    ]]);
    formatIntraCourseSlotsForPdf.onCall(0).returns({ startHour: 'slot1' });
    formatIntraCourseSlotsForPdf.onCall(1).returns({ startHour: 'slot2' });
    formatIntraCourseSlotsForPdf.onCall(2).returns({ startHour: 'slot3' });

    const result = CourseHelper.formatIntraCourseForPdf(course);

    expect(result).toEqual({
      dates: [{
        course: {
          name: 'programme - des infos en plus',
          duration: '8h',
          company: 'alenvi, biens communs',
          trainer: 'MasterClass',
          type: INTRA_HOLDING,
        },
        address: '37 rue de Ponthieu 75008 Paris',
        slots: [{ startHour: 'slot1' }],
        date: '20/03/2020',
      }, {
        course: {
          name: 'programme - des infos en plus',
          duration: '8h',
          company: 'alenvi, biens communs',
          trainer: 'MasterClass',
          type: INTRA_HOLDING,
        },
        address: '',
        slots: [{ startHour: 'slot2' }, { startHour: 'slot3' }],
        date: '12/04/2020',
      }],
    });
    sinon.assert.calledOnceWithExactly(getTotalDuration, course.slots);
    sinon.assert.calledOnceWithExactly(formatIdentity, { lastname: 'MasterClass' }, 'FL');
    sinon.assert.calledOnceWithExactly(groupSlotsByDate, [
      {
        startDate: '2020-03-20T09:00:00',
        endDate: '2020-03-20T11:00:00',
        address: { fullAddress: '37 rue de Ponthieu 75008 Paris' },
        step: { type: 'on_site' },
      },
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
      { startDate: '2020-04-12T14:00:00', endDate: '2020-04-12T17:30:00', step: { type: 'on_site' } },
    ]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(0), course.slots[0]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(1), course.slots[1]);
    sinon.assert.calledWithExactly(formatIntraCourseSlotsForPdf.getCall(2), course.slots[2]);
    sinon.assert.callCount(formatIntraCourseSlotsForPdf, 3);
  });
});

describe('formatInterCourseForPdf', () => {
  let formatIdentity;
  let getTotalDuration;
  let formatInterCourseSlotsForPdf;
  let getCompanyAtCourseRegistrationList;
  let findCompanies;
  beforeEach(() => {
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    getTotalDuration = sinon.stub(UtilsHelper, 'getTotalDuration');
    formatInterCourseSlotsForPdf = sinon.stub(CourseHelper, 'formatInterCourseSlotsForPdf');
    getCompanyAtCourseRegistrationList = sinon
      .stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
    findCompanies = sinon.stub(Company, 'find');
  });
  afterEach(() => {
    formatIdentity.restore();
    getTotalDuration.restore();
    formatInterCourseSlotsForPdf.restore();
    getCompanyAtCourseRegistrationList.restore();
    findCompanies.restore();
  });

  it('should format course for pdf', async () => {
    const traineeIds = [new ObjectId(), new ObjectId()];
    const companyId = new ObjectId();
    const course = {
      _id: new ObjectId(),
      slots: [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00', step: { type: 'on_site' } },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-15T11:30:00', step: { type: 'remote' } },
      ],
      misc: 'des infos en plus',
      trainers: [
        { identity: { lastname: 'MasterClass' } },
        { identity: { lastname: 'MasterCompani' } },
      ],
      trainees: [
        { _id: traineeIds[0], identity: { lastname: 'trainee 1' } },
        { _id: traineeIds[1], identity: { lastname: 'trainee 2' } },
      ],
      subProgram: { program: { name: 'programme de formation' } },
    };
    const sortedSlots = [
      { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00', step: { type: 'on_site' } },
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
      { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00', step: { type: 'on_site' } },
    ];
    formatInterCourseSlotsForPdf.returns('slot');
    formatIdentity.onCall(0).returns('trainee 1');
    formatIdentity.onCall(1).returns('trainee 2');
    getTotalDuration.returns('7h');
    getCompanyAtCourseRegistrationList
      .returns([{ trainee: traineeIds[0], company: companyId }, { trainee: traineeIds[1], company: companyId }]);
    findCompanies.returns(SinonMongoose.stubChainedQueries([{ _id: companyId, name: 'alenvi' }], ['lean']));

    const result = await CourseHelper.formatInterCourseForPdf(course);

    expect(result).toEqual({
      trainees: [
        {
          traineeName: 'trainee 1',
          registrationCompany: 'alenvi',
          course: {
            name: 'programme de formation - des infos en plus',
            slots: ['slot', 'slot', 'slot'],
            trainer: '',
            firstDate: '20/03/2020',
            lastDate: '21/04/2020',
            duration: '7h',
          },
        },
        {
          traineeName: 'trainee 2',
          registrationCompany: 'alenvi',
          course: {
            name: 'programme de formation - des infos en plus',
            slots: ['slot', 'slot', 'slot'],
            trainer: '',
            firstDate: '20/03/2020',
            lastDate: '21/04/2020',
            duration: '7h',
          },
        },
      ],
    });
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledOnceWithExactly(getTotalDuration, sortedSlots);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      { key: TRAINEE, value: course.trainees }
    );
    sinon.assert.callCount(formatInterCourseSlotsForPdf, 3);
    SinonMongoose.calledOnceWithExactly(
      findCompanies,
      [
        { query: 'find', args: [{ _id: { $in: [companyId] } }, { name: 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should format course without trainees', async () => {
    const course = {
      _id: new ObjectId(),
      slots: [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00', step: { type: 'on_site' } },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-15T11:30:00', step: { type: 'remote' } },
      ],
      misc: 'des infos en plus',
      trainers: [{ identity: { lastname: 'MasterClass' } }],
      trainees: [],
      subProgram: { program: { name: 'programme de formation' } },
    };
    const sortedSlots = [
      { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00', step: { type: 'on_site' } },
      { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00', step: { type: 'on_site' } },
      { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00', step: { type: 'on_site' } },
    ];
    formatInterCourseSlotsForPdf.returns('slot');
    formatIdentity.returns('MasterClass');
    getTotalDuration.returns('7h');
    getCompanyAtCourseRegistrationList.returns([]);
    findCompanies.returns(SinonMongoose.stubChainedQueries([], ['lean']));

    const result = await CourseHelper.formatInterCourseForPdf(course);

    expect(result).toEqual({
      trainees: [
        {
          traineeName: '',
          registrationCompany: '',
          course: {
            name: 'programme de formation - des infos en plus',
            slots: ['slot', 'slot', 'slot'],
            trainer: 'MasterClass',
            firstDate: '20/03/2020',
            lastDate: '21/04/2020',
            duration: '7h',
          },
        },
      ],
    });
    sinon.assert.calledOnceWithExactly(formatIdentity, { lastname: 'MasterClass' }, 'FL');
    sinon.assert.calledOnceWithExactly(getTotalDuration, sortedSlots);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      { key: TRAINEE, value: course.trainees }
    );
    sinon.assert.callCount(formatInterCourseSlotsForPdf, 3);
    SinonMongoose.calledOnceWithExactly(
      findCompanies,
      [
        { query: 'find', args: [{ _id: { $in: [] } }, { name: 1 }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('generateAttendanceSheets', () => {
  let courseFindOne;
  let formatInterCourseForPdf;
  let formatIntraCourseForPdf;
  let generatePdf;
  let interAttendanceSheetGetPdf;
  let intraAttendanceSheetGetPdf;
  beforeEach(() => {
    courseFindOne = sinon.stub(Course, 'findOne');
    formatInterCourseForPdf = sinon.stub(CourseHelper, 'formatInterCourseForPdf');
    formatIntraCourseForPdf = sinon.stub(CourseHelper, 'formatIntraCourseForPdf');
    generatePdf = sinon.stub(PdfHelper, 'generatePdf');
    interAttendanceSheetGetPdf = sinon.stub(InterAttendanceSheet, 'getPdf');
    intraAttendanceSheetGetPdf = sinon.stub(IntraAttendanceSheet, 'getPdf');
  });
  afterEach(() => {
    courseFindOne.restore();
    formatInterCourseForPdf.restore();
    formatIntraCourseForPdf.restore();
    generatePdf.restore();
    interAttendanceSheetGetPdf.restore();
    intraAttendanceSheetGetPdf.restore();
  });

  it('should download attendance sheet for inter b2b course', async () => {
    const courseId = new ObjectId();
    const course = { misc: 'des infos en plus', type: INTER_B2B };

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    formatInterCourseForPdf.returns({ name: 'la formation - des infos en plus' });
    interAttendanceSheetGetPdf.returns('pdf');

    await CourseHelper.generateAttendanceSheets(courseId);

    SinonMongoose.calledOnceWithExactly(courseFindOne, [
      { query: 'findOne', args: [{ _id: courseId }, { misc: 1, type: 1 }] },
      { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
      {
        query: 'populate',
        args: [{ path: 'slots', select: 'step startDate endDate address', populate: { path: 'step', select: 'type' } }],
      },
      {
        query: 'populate',
        args: [{ path: 'trainees', select: 'identity' }],
      },
      { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
      {
        query: 'populate',
        args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
      },
      { query: 'lean' },
    ]);
    sinon.assert.calledOnceWithExactly(formatInterCourseForPdf, course);
    sinon.assert.notCalled(formatIntraCourseForPdf);
    sinon.assert.notCalled(intraAttendanceSheetGetPdf);
    sinon.assert.calledOnceWithExactly(interAttendanceSheetGetPdf, { name: 'la formation - des infos en plus' });
  });

  it('should download attendance sheet for intra course', async () => {
    const courseId = new ObjectId();
    const course = { misc: 'des infos en plus', type: INTRA };

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    formatIntraCourseForPdf.returns({ name: 'la formation - des infos en plus' });
    intraAttendanceSheetGetPdf.returns('pdf');

    await CourseHelper.generateAttendanceSheets(courseId);

    SinonMongoose.calledOnceWithExactly(courseFindOne, [
      { query: 'findOne', args: [{ _id: courseId }, { misc: 1, type: 1 }] },
      { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
      {
        query: 'populate',
        args: [{ path: 'slots', select: 'step startDate endDate address', populate: { path: 'step', select: 'type' } }],
      },
      {
        query: 'populate',
        args: [{ path: 'trainees', select: 'identity' }],
      },
      { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
      {
        query: 'populate',
        args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
      },
      { query: 'lean' },
    ]);
    sinon.assert.calledOnceWithExactly(formatIntraCourseForPdf, course);
    sinon.assert.notCalled(formatInterCourseForPdf);
    sinon.assert.calledOnceWithExactly(intraAttendanceSheetGetPdf, { name: 'la formation - des infos en plus' });
  });

  it('should download attendance sheet for intra_holding course', async () => {
    const courseId = new ObjectId();
    const course = { misc: 'des infos en plus', type: INTRA_HOLDING };

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    formatIntraCourseForPdf.returns({ name: 'la formation - des infos en plus' });
    intraAttendanceSheetGetPdf.returns('pdf');

    await CourseHelper.generateAttendanceSheets(courseId);

    SinonMongoose.calledOnceWithExactly(courseFindOne, [
      { query: 'findOne', args: [{ _id: courseId }, { misc: 1, type: 1 }] },
      { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
      {
        query: 'populate',
        args: [{ path: 'slots', select: 'step startDate endDate address', populate: { path: 'step', select: 'type' } }],
      },
      {
        query: 'populate',
        args: [{ path: 'trainees', select: 'identity' }],
      },
      { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
      {
        query: 'populate',
        args: [{ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } }],
      },
      { query: 'lean' },
    ]);
    sinon.assert.calledOnceWithExactly(formatIntraCourseForPdf, course);
    sinon.assert.notCalled(formatInterCourseForPdf);
    sinon.assert.calledOnceWithExactly(intraAttendanceSheetGetPdf, { name: 'la formation - des infos en plus' });
  });
});

describe('formatCourseForDocuments', () => {
  let getTotalDuration;
  beforeEach(() => {
    getTotalDuration = sinon.stub(UtilsHelper, 'getTotalDuration');
  });
  afterEach(() => {
    getTotalDuration.restore();
  });

  it('should format course for docx (custom certificate)', () => {
    const course = {
      slots: [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
      ],
      subProgram: {
        program: { learningGoals: 'Apprendre', name: 'nom du programme' },
        steps: [{ type: E_LEARNING, theoreticalDuration: 'PT3600S' }],
      },
    };
    getTotalDuration.returns('PT25200S');

    const result = CourseHelper.formatCourseForDocuments(course);

    expect(result).toEqual({
      duration: { onSite: '7h', eLearning: '1h', total: '8h' },
      learningGoals: 'Apprendre',
      startDate: '20/03/2020',
      endDate: '21/04/2020',
      programName: 'NOM DU PROGRAMME',
      steps: [{ type: E_LEARNING, theoreticalDuration: 'PT3600S' }],
    });
    sinon.assert.calledOnceWithExactly(
      getTotalDuration,
      [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
      ],
      false
    );
  });

  it('should format course for docx (official certificate)', () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const companies = [{ _id: companyId, name: 'structure' }, { _id: otherCompanyId, name: 'other structure' }];

    const course = {
      slots: [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
      ],
      subProgram: {
        program: { learningGoals: 'Apprendre', name: 'nom du programme' },
        steps: [],
      },
      companies,
    };
    getTotalDuration.returns('PT25200S');

    const result = CourseHelper.formatCourseForDocuments(course, OFFICIAL);

    expect(result).toEqual({
      duration: { onSite: '7h', eLearning: '0h', total: '7h' },
      learningGoals: 'Apprendre',
      startDate: '20/03/2020',
      endDate: '21/04/2020',
      programName: 'NOM DU PROGRAMME',
      companyNamesById: { [companyId]: 'structure', [otherCompanyId]: 'other structure' },
      steps: [],
    });
    sinon.assert.calledOnceWithExactly(
      getTotalDuration,
      [
        { startDate: '2020-03-20T09:00:00', endDate: '2020-03-20T11:00:00' },
        { startDate: '2020-04-12T09:00:00', endDate: '2020-04-12T11:30:00' },
        { startDate: '2020-04-21T09:00:00', endDate: '2020-04-21T11:30:00' },
      ],
      false
    );
  });
});

describe('generateCompletionCertificates', () => {
  let courseFindOne;
  let attendanceFind;
  let formatCourseForDocuments;
  let formatIdentity;
  let getTotalDuration;
  let createDocx;
  let generateZip;
  let createReadStream;
  let downloadFileById;
  let tmpDir;
  let getPdf;
  let getCompanyAtCourseRegistrationList;
  beforeEach(() => {
    courseFindOne = sinon.stub(Course, 'findOne');
    attendanceFind = sinon.stub(Attendance, 'find');
    formatCourseForDocuments = sinon.stub(CourseHelper, 'formatCourseForDocuments');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    getTotalDuration = sinon.stub(UtilsHelper, 'getTotalDuration');
    createDocx = sinon.stub(DocxHelper, 'createDocx');
    generateZip = sinon.stub(ZipHelper, 'generateZip');
    UtilsMock.mockCurrentDate('2020-01-20T07:00:00.000Z');
    createReadStream = sinon.stub(fs, 'createReadStream');
    downloadFileById = sinon.stub(Drive, 'downloadFileById');
    tmpDir = sinon.stub(os, 'tmpdir').returns('/path');
    getPdf = sinon.stub(CompletionCertificate, 'getPdf');
    getCompanyAtCourseRegistrationList = sinon
      .stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
  });
  afterEach(() => {
    courseFindOne.restore();
    attendanceFind.restore();
    formatCourseForDocuments.restore();
    formatIdentity.restore();
    getTotalDuration.restore();
    createDocx.restore();
    generateZip.restore();
    UtilsMock.unmockCurrentDate();
    createReadStream.restore();
    downloadFileById.restore();
    tmpDir.restore();
    getPdf.restore();
    getCompanyAtCourseRegistrationList.restore();
  });

  it('should download custom completion certificates from webapp (word with eLearning)', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();

    const credentials = {
      _id: new ObjectId(),
      role: { vendor: { name: 'vendor_admin' } },
      company: { _id: companyId },
    };
    const courseId = new ObjectId();
    const readable1 = new PassThrough();
    const readable2 = new PassThrough();
    const readable3 = new PassThrough();
    const traineesIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const course = {
      trainees: [
        { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
        { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
        { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
      ],
      misc: 'Bonjour je suis une formation',
      trainer: new ObjectId(),
      companies: [companyId, otherCompanyId],
      subProgram: {
        program: { learningGoals: 'Apprendre', name: 'nom du programme' },
        steps: [
          {
            type: E_LEARNING,
            theoreticalDuration: 'PT7200S',
            activities: [
              { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }, { user: traineesIds[1] }] },
              { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }] },
            ],
          }],
      },
      slots: [
        { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T09:30:00.000Z' },
        { startDate: '2022-01-21T09:30:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      ],
    };
    const attendances = [
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T09:30:00.000Z' },
      },
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-21T09:30:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      },
      {
        trainee: traineesIds[1],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T09:30:00.000Z' },
      },
    ];
    const query = { format: ALL_WORD, type: CUSTOM };

    attendanceFind.returns(SinonMongoose.stubChainedQueries(attendances, ['populate', 'setOptions', 'lean']));
    courseFindOne.onCall(0).returns(SinonMongoose.stubChainedQueries(
      {
        trainees: traineesIds,
        misc: 'Bonjour je suis une formation',
        trainer: new ObjectId(),
        companies: [companyId, otherCompanyId],
      },
      ['lean']
    ));
    courseFindOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    getCompanyAtCourseRegistrationList.returns([
      { trainee: traineesIds[0], company: companyId },
      { trainee: traineesIds[1], company: companyId },
      { trainee: traineesIds[2], company: otherCompanyId },
    ]);
    formatCourseForDocuments.returns({
      duration: { onSite: '6h30', eLearning: '2h', total: '8h30' },
      learningGoals: 'Apprendre',
      programName: 'nom du programme',
      startDate: '2022-01-18T07:00:00.000Z',
      endDate: '2022-01-21T13:30:00.000Z',
      steps: [{
        type: E_LEARNING,
        theoreticalDuration: 'PT7200S',
        activities: [
          { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }, { user: traineesIds[1] }] },
          { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }] },
        ],
      }],
    });
    createDocx.onCall(0).returns('1.docx');
    createDocx.onCall(1).returns('2.docx');
    createDocx.onCall(2).returns('3.docx');
    formatIdentity.onCall(0).returns('trainee 1');
    formatIdentity.onCall(1).returns('trainee 2');
    formatIdentity.onCall(2).returns('trainee 3');
    getTotalDuration.onCall(0).returns('PT23400S');
    getTotalDuration.onCall(1).returns('PT9000S');
    getTotalDuration.onCall(2).returns('PT0S');
    createReadStream.onCall(0).returns(readable1);
    createReadStream.onCall(1).returns(readable2);
    createReadStream.onCall(2).returns(readable3);

    await CourseHelper.generateCompletionCertificates(courseId, credentials, query);

    sinon.assert.calledOnceWithExactly(formatCourseForDocuments, course, query.type);
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { lastname: 'trainee 3' }, 'FL');
    sinon.assert.calledWithExactly(
      getTotalDuration.getCall(0),
      [attendances[0].courseSlot, attendances[1].courseSlot],
      false
    );
    sinon.assert.calledWithExactly(getTotalDuration.getCall(1), [attendances[2].courseSlot], false);
    sinon.assert.calledWithExactly(getTotalDuration.getCall(2), [], false);
    sinon.assert.calledWithExactly(
      createDocx.getCall(0),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '2h', total: '8h30' },
        learningGoals: 'Apprendre',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 1', attendanceDuration: '6h30', eLearningDuration: '2h', totalDuration: '8h30' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(1),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '2h', total: '8h30' },
        learningGoals: 'Apprendre',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 2', attendanceDuration: '2h30', eLearningDuration: '1h', totalDuration: '3h30' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(2),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '2h', total: '8h30' },
        learningGoals: 'Apprendre',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 3', attendanceDuration: '0h', eLearningDuration: '0h', totalDuration: '0h' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledOnceWithExactly(
      generateZip,
      'attestations_word.zip',
      [
        { name: 'Attestation - trainee 1.docx', file: readable1 },
        { name: 'Attestation - trainee 2.docx', file: readable2 },
        { name: 'Attestation - trainee 3.docx', file: readable3 },
      ]
    );
    sinon.assert.calledWithExactly(createReadStream.getCall(0), '1.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(1), '2.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(2), '3.docx');
    sinon.assert.calledOnceWithExactly(
      downloadFileById,
      {
        fileId: process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_WITH_ELEARNING_ID,
        tmpFilePath: '/path/certificate_template.docx',
      }
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name learningGoals' },
              {
                path: 'steps',
                select: 'type theoreticalDuration',
                match: { type: E_LEARNING },
                populate: {
                  path: 'activities',
                  populate: { path: 'activityHistories', match: { user: { $in: traineesIds } } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      attendanceFind,
      [
        { query: 'find', args: [{ courseSlot: course.slots.map(s => s._id), company: { $in: course.companies } }] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate' }] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      {
        key: TRAINEE,
        value: [
          { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
          { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
          { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
        ],
      }
    );
    sinon.assert.notCalled(getPdf);
  });

  it('should download custom completion certificates from webapp (word without eLearning)', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();

    const credentials = {
      _id: new ObjectId(),
      role: { vendor: { name: 'vendor_admin' } },
      company: { _id: companyId },
    };
    const courseId = new ObjectId();
    const readable1 = new PassThrough();
    const readable2 = new PassThrough();
    const readable3 = new PassThrough();
    const traineesIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const course = {
      trainees: [
        { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
        { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
        { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
      ],
      misc: 'Bonjour je suis une formation',
      trainer: new ObjectId(),
      companies: [companyId, otherCompanyId],
      subProgram: {
        program: { learningGoals: 'Apprendre', name: 'nom du programme' },
        steps: [],
      },
      slots: [
        { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T09:30:00.000Z' },
        { startDate: '2022-01-21T09:30:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      ],
    };
    const attendances = [
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T09:30:00.000Z' },
      },
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-21T09:30:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      },
      {
        trainee: traineesIds[1],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T09:30:00.000Z' },
      },
    ];
    const query = { format: ALL_WORD, type: CUSTOM };

    attendanceFind.returns(SinonMongoose.stubChainedQueries(attendances, ['populate', 'setOptions', 'lean']));
    courseFindOne.onCall(0).returns(SinonMongoose.stubChainedQueries(
      {
        trainees: traineesIds,
        misc: 'Bonjour je suis une formation',
        trainer: new ObjectId(),
        companies: [companyId, otherCompanyId],
      },
      ['lean']
    ));
    courseFindOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    getCompanyAtCourseRegistrationList.returns([
      { trainee: traineesIds[0], company: companyId },
      { trainee: traineesIds[1], company: companyId },
      { trainee: traineesIds[2], company: otherCompanyId },
    ]);
    formatCourseForDocuments.returns({
      duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
      learningGoals: 'Apprendre',
      programName: 'nom du programme',
      startDate: '2022-01-18T07:00:00.000Z',
      endDate: '2022-01-21T13:30:00.000Z',
      steps: [],
    });
    createDocx.onCall(0).returns('1.docx');
    createDocx.onCall(1).returns('2.docx');
    createDocx.onCall(2).returns('3.docx');
    formatIdentity.onCall(0).returns('trainee 1');
    formatIdentity.onCall(1).returns('trainee 2');
    formatIdentity.onCall(2).returns('trainee 3');
    getTotalDuration.onCall(0).returns('PT23400S');
    getTotalDuration.onCall(1).returns('PT9000S');
    getTotalDuration.onCall(2).returns('PT0S');
    createReadStream.onCall(0).returns(readable1);
    createReadStream.onCall(1).returns(readable2);
    createReadStream.onCall(2).returns(readable3);

    await CourseHelper.generateCompletionCertificates(courseId, credentials, query);

    sinon.assert.calledOnceWithExactly(formatCourseForDocuments, course, query.type);
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { lastname: 'trainee 3' }, 'FL');
    sinon.assert.calledWithExactly(
      getTotalDuration.getCall(0),
      [attendances[0].courseSlot, attendances[1].courseSlot],
      false
    );
    sinon.assert.calledWithExactly(getTotalDuration.getCall(1), [attendances[2].courseSlot], false);
    sinon.assert.calledWithExactly(getTotalDuration.getCall(2), [], false);
    sinon.assert.calledWithExactly(
      createDocx.getCall(0),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
        learningGoals: 'Apprendre',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 1', attendanceDuration: '6h30', eLearningDuration: '0h', totalDuration: '6h30' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(1),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
        learningGoals: 'Apprendre',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 2', attendanceDuration: '2h30', eLearningDuration: '0h', totalDuration: '2h30' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(2),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
        learningGoals: 'Apprendre',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 3', attendanceDuration: '0h', eLearningDuration: '0h', totalDuration: '0h' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledOnceWithExactly(
      generateZip,
      'attestations_word.zip',
      [
        { name: 'Attestation - trainee 1.docx', file: readable1 },
        { name: 'Attestation - trainee 2.docx', file: readable2 },
        { name: 'Attestation - trainee 3.docx', file: readable3 },
      ]
    );
    sinon.assert.calledWithExactly(createReadStream.getCall(0), '1.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(1), '2.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(2), '3.docx');
    sinon.assert.calledOnceWithExactly(
      downloadFileById,
      {
        fileId: process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID,
        tmpFilePath: '/path/certificate_template.docx',
      }
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name learningGoals' },
              {
                path: 'steps',
                select: 'type theoreticalDuration',
                match: { type: E_LEARNING },
                populate: {
                  path: 'activities',
                  populate: { path: 'activityHistories', match: { user: { $in: traineesIds } } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      attendanceFind,
      [
        { query: 'find', args: [{ courseSlot: course.slots.map(s => s._id), company: { $in: course.companies } }] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate' }] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      {
        key: TRAINEE,
        value: [
          { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
          { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
          { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
        ],
      }
    );
    sinon.assert.notCalled(getPdf);
  });

  it('should download official completion certificates from webapp (word with eLearning)', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const companies = [{ _id: companyId, name: 'structure 1' }, { _id: otherCompanyId, name: 'structure 2' }];

    const credentials = {
      _id: new ObjectId(),
      role: { vendor: { name: 'vendor_admin' } },
      company: { _id: companyId },
    };
    const courseId = new ObjectId();
    const readable1 = new PassThrough();
    const readable2 = new PassThrough();
    const readable3 = new PassThrough();
    const traineesIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const course = {
      trainees: [
        { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
        { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
        { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
      ],
      misc: 'Bonjour je suis une formation',
      trainer: new ObjectId(),
      companies: companies.map(c => c._id),
      subProgram: {
        program: { learningGoals: 'Objectifs', name: 'nom du programme' },
        steps: [
          {
            type: E_LEARNING,
            theoreticalDuration: 'PT7200S',
            activities: [
              { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }, { user: traineesIds[1] }] },
              { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }] },
            ],
          },
          {
            type: E_LEARNING,
            theoreticalDuration: 'PT3600S',
            activities: [
              { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }, { user: traineesIds[1] }] },
              { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }, { user: traineesIds[1] }] },
            ],
          },
        ],
      },
      slots: [
        { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
        { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      ],
    };
    const attendances = [
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      },
      {
        trainee: traineesIds[1],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
    ];
    const query = { format: ALL_WORD, type: OFFICIAL };

    attendanceFind.returns(SinonMongoose.stubChainedQueries(attendances, ['populate', 'setOptions', 'lean']));
    courseFindOne.onCall(0).returns(SinonMongoose.stubChainedQueries(
      {
        trainees: traineesIds,
        misc: 'Bonjour je suis une formation',
        trainer: new ObjectId(),
        companies: companies.map(c => c._id),
      },
      ['lean']
    ));
    courseFindOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    getCompanyAtCourseRegistrationList.returns([
      { trainee: traineesIds[0], company: companyId },
      { trainee: traineesIds[1], company: companyId },
      { trainee: traineesIds[2], company: otherCompanyId },
    ]);
    formatCourseForDocuments.returns({
      duration: { onSite: '6h30', eLearning: '3h', total: '9h30' },
      learningGoals: 'Objectifs',
      programName: 'nom du programme',
      startDate: '2022-01-18T07:00:00.000Z',
      endDate: '2022-01-21T13:30:00.000Z',
      companyNamesById: { [companyId]: 'structure 1', [companyId]: 'structure 1', [otherCompanyId]: 'structure 2' },
      steps: course.subProgram.steps,
    });
    createDocx.onCall(0).returns('1.docx');
    createDocx.onCall(1).returns('2.docx');
    createDocx.onCall(2).returns('3.docx');
    formatIdentity.onCall(0).returns('trainee 1');
    formatIdentity.onCall(1).returns('trainee 2');
    formatIdentity.onCall(2).returns('trainee 3');
    getTotalDuration.onCall(0).returns('PT16200S');
    getTotalDuration.onCall(1).returns('PT10800S');
    getTotalDuration.onCall(2).returns('PT0S');
    createReadStream.onCall(0).returns(readable1);
    createReadStream.onCall(1).returns(readable2);
    createReadStream.onCall(2).returns(readable3);

    await CourseHelper.generateCompletionCertificates(courseId, credentials, query);

    sinon.assert.calledOnceWithExactly(formatCourseForDocuments, course, query.type);
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { lastname: 'trainee 3' }, 'FL');
    sinon.assert.calledWithExactly(
      getTotalDuration.getCall(0),
      [attendances[0].courseSlot, attendances[1].courseSlot],
      false
    );
    sinon.assert.calledWithExactly(getTotalDuration.getCall(1), [attendances[2].courseSlot], false);
    sinon.assert.calledWithExactly(getTotalDuration.getCall(2), [], false);
    sinon.assert.calledWithExactly(
      createDocx.getCall(0),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '3h', total: '9h30' },
        learningGoals: 'Objectifs',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: {
          identity: 'trainee 1',
          attendanceDuration: '4h30',
          companyName: 'structure 1',
          eLearningDuration: '3h',
          totalDuration: '7h30',
        },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(1),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '3h', total: '9h30' },
        learningGoals: 'Objectifs',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: {
          identity: 'trainee 2',
          attendanceDuration: '3h',
          companyName: 'structure 1',
          eLearningDuration: '2h',
          totalDuration: '5h',
        },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(2),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '3h', total: '9h30' },
        learningGoals: 'Objectifs',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: {
          identity: 'trainee 3',
          attendanceDuration: '0h',
          companyName: 'structure 2',
          eLearningDuration: '0h',
          totalDuration: '0h',
        },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledOnceWithExactly(
      generateZip,
      'certificats_word.zip',
      [
        { name: 'Certificat - trainee 1.docx', file: readable1 },
        { name: 'Certificat - trainee 2.docx', file: readable2 },
        { name: 'Certificat - trainee 3.docx', file: readable3 },
      ]
    );
    sinon.assert.calledWithExactly(createReadStream.getCall(0), '1.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(1), '2.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(2), '3.docx');
    sinon.assert.calledOnceWithExactly(
      downloadFileById,
      {
        fileId: process.env.GOOGLE_DRIVE_OFFICIAL_TRAINING_CERTIFICATE_TEMPLATE_WITH_ELEARNING_ID,
        tmpFilePath: '/path/certificate_template.docx',
      }
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name learningGoals' },
              {
                path: 'steps',
                select: 'type theoreticalDuration',
                match: { type: E_LEARNING },
                populate: {
                  path: 'activities',
                  populate: { path: 'activityHistories', match: { user: { $in: traineesIds } } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      attendanceFind,
      [
        { query: 'find', args: [{ courseSlot: course.slots.map(s => s._id), company: { $in: course.companies } }] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate' }] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      {
        key: TRAINEE,
        value: [
          { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
          { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
          { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
        ],
      }
    );
    sinon.assert.notCalled(getPdf);
  });

  it('should download official completion certificates from webapp (word without eLearning)', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const companies = [{ _id: companyId, name: 'structure 1' }, { _id: otherCompanyId, name: 'structure 2' }];

    const credentials = {
      _id: new ObjectId(),
      role: { vendor: { name: 'vendor_admin' } },
      company: { _id: companyId },
    };
    const courseId = new ObjectId();
    const readable1 = new PassThrough();
    const readable2 = new PassThrough();
    const readable3 = new PassThrough();
    const traineesIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const course = {
      trainees: [
        { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
        { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
        { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
      ],
      misc: 'Bonjour je suis une formation',
      trainer: new ObjectId(),
      companies: companies.map(c => c._id),
      subProgram: { program: { learningGoals: 'Objectifs', name: 'nom du programme' }, steps: [] },
      slots: [
        { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
        { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      ],
    };
    const attendances = [
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      },
      {
        trainee: traineesIds[1],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
    ];
    const query = { format: ALL_WORD, type: OFFICIAL };

    attendanceFind.returns(SinonMongoose.stubChainedQueries(attendances, ['populate', 'setOptions', 'lean']));
    courseFindOne.onCall(0).returns(SinonMongoose.stubChainedQueries(
      {
        trainees: traineesIds,
        misc: 'Bonjour je suis une formation',
        trainer: new ObjectId(),
        companies: companies.map(c => c._id),
      },
      ['lean']
    ));
    courseFindOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    getCompanyAtCourseRegistrationList.returns([
      { trainee: traineesIds[0], company: companyId },
      { trainee: traineesIds[1], company: companyId },
      { trainee: traineesIds[2], company: otherCompanyId },
    ]);
    formatCourseForDocuments.returns({
      duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
      learningGoals: 'Objectifs',
      programName: 'nom du programme',
      startDate: '2022-01-18T07:00:00.000Z',
      endDate: '2022-01-21T13:30:00.000Z',
      companyNamesById: { [companyId]: 'structure 1', [companyId]: 'structure 1', [otherCompanyId]: 'structure 2' },
      steps: [],
    });
    createDocx.onCall(0).returns('1.docx');
    createDocx.onCall(1).returns('2.docx');
    createDocx.onCall(2).returns('3.docx');
    formatIdentity.onCall(0).returns('trainee 1');
    formatIdentity.onCall(1).returns('trainee 2');
    formatIdentity.onCall(2).returns('trainee 3');
    getTotalDuration.onCall(0).returns('PT16200S');
    getTotalDuration.onCall(1).returns('PT10800S');
    getTotalDuration.onCall(2).returns('PT0S');
    createReadStream.onCall(0).returns(readable1);
    createReadStream.onCall(1).returns(readable2);
    createReadStream.onCall(2).returns(readable3);

    await CourseHelper.generateCompletionCertificates(courseId, credentials, query);

    sinon.assert.calledOnceWithExactly(formatCourseForDocuments, course, query.type);
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { lastname: 'trainee 3' }, 'FL');
    sinon.assert.calledWithExactly(
      getTotalDuration.getCall(0),
      [attendances[0].courseSlot, attendances[1].courseSlot],
      false
    );
    sinon.assert.calledWithExactly(getTotalDuration.getCall(1), [attendances[2].courseSlot], false);
    sinon.assert.calledWithExactly(getTotalDuration.getCall(2), [], false);
    sinon.assert.calledWithExactly(
      createDocx.getCall(0),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
        learningGoals: 'Objectifs',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: {
          identity: 'trainee 1',
          attendanceDuration: '4h30',
          companyName: 'structure 1',
          eLearningDuration: '0h',
          totalDuration: '4h30',
        },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(1),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
        learningGoals: 'Objectifs',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: {
          identity: 'trainee 2',
          attendanceDuration: '3h',
          companyName: 'structure 1',
          eLearningDuration: '0h',
          totalDuration: '3h',
        },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      createDocx.getCall(2),
      '/path/certificate_template.docx',
      {
        duration: { onSite: '6h30', eLearning: '0h', total: '6h30' },
        learningGoals: 'Objectifs',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: {
          identity: 'trainee 3',
          attendanceDuration: '0h',
          companyName: 'structure 2',
          eLearningDuration: '0h',
          totalDuration: '0h',
        },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledOnceWithExactly(
      generateZip,
      'certificats_word.zip',
      [
        { name: 'Certificat - trainee 1.docx', file: readable1 },
        { name: 'Certificat - trainee 2.docx', file: readable2 },
        { name: 'Certificat - trainee 3.docx', file: readable3 },
      ]
    );
    sinon.assert.calledWithExactly(createReadStream.getCall(0), '1.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(1), '2.docx');
    sinon.assert.calledWithExactly(createReadStream.getCall(2), '3.docx');
    sinon.assert.calledOnceWithExactly(
      downloadFileById,
      {
        fileId: process.env.GOOGLE_DRIVE_OFFICIAL_TRAINING_CERTIFICATE_TEMPLATE_ID,
        tmpFilePath: '/path/certificate_template.docx',
      }
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name learningGoals' },
              {
                path: 'steps',
                select: 'type theoreticalDuration',
                match: { type: E_LEARNING },
                populate: {
                  path: 'activities',
                  populate: { path: 'activityHistories', match: { user: { $in: traineesIds } } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      attendanceFind,
      [
        { query: 'find', args: [{ courseSlot: course.slots.map(s => s._id), company: { $in: course.companies } }] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate' }] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      {
        key: TRAINEE,
        value: [
          { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
          { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
          { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
        ],
      }
    );
    sinon.assert.notCalled(getPdf);
  });

  it('should download completion certificates from webapp (client)', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const credentials = {
      _id: new ObjectId(),
      role: { client: 'admin', holding: 'holding_admin' },
      company: { _id: companyId },
      holding: { companies: [companyId, otherCompanyId] },
    };
    const courseId = new ObjectId();
    const traineesIds = [new ObjectId(), new ObjectId(), new ObjectId()];

    const course = {
      _id: courseId,
      trainees: [
        { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
        { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
        { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
      ],
      misc: 'Bonjour je suis une formation',
      companies: [companyId, new ObjectId(), otherCompanyId],
      subProgram: {
        program: { learningGoals: 'Apprendre plein de trucs cool', name: 'un programme' },
        steps: [{
          type: E_LEARNING,
          theoreticalDuration: 'PT3600S',
          activities: [
            { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }, { user: traineesIds[1] }] },
            { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }] },
          ],
        }],
      },
      slots: [
        { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
        { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      ],
    };
    const attendances = [
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      },
      {
        trainee: traineesIds[1],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
    ];
    const query = { format: ALL_PDF, type: CUSTOM };

    attendanceFind.returns(SinonMongoose.stubChainedQueries(attendances, ['populate', 'setOptions', 'lean']));
    courseFindOne.onCall(0).returns(SinonMongoose.stubChainedQueries(
      {
        trainees: traineesIds,
        misc: 'Bonjour je suis une formation',
        trainer: new ObjectId(),
        companies: [companyId, new ObjectId(), otherCompanyId],
      },
      ['lean']
    ));
    courseFindOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    formatCourseForDocuments.returns({
      duration: { onSite: '6h30', eLearning: '1h', total: '7h30' },
      learningGoals: 'Apprendre plein de trucs cool',
      programName: 'unprogramme',
      startDate: '2022-01-18T07:00:00.000Z',
      endDate: '2022-01-21T13:30:00.000Z',
      steps: course.subProgram.steps,
    });
    getCompanyAtCourseRegistrationList.returns([
      { trainee: traineesIds[0], company: companyId },
      { trainee: traineesIds[1], company: otherCompanyId },
      { trainee: traineesIds[2], company: new ObjectId() },
    ]);
    formatIdentity.onCall(0).returns('trainee 1');
    formatIdentity.onCall(1).returns('trainee 2');
    getTotalDuration.onCall(0).returns('PT16200S');
    getTotalDuration.onCall(1).returns('PT10800S');
    getPdf.onCall(0).returns('pdf 1');
    getPdf.onCall(1).returns('pdf 2');

    await CourseHelper.generateCompletionCertificates(courseId, credentials, query);

    sinon.assert.calledOnceWithExactly(formatCourseForDocuments, course, query.type);
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { lastname: 'trainee 2' }, 'FL');
    sinon.assert.calledWithExactly(
      getTotalDuration.getCall(0),
      [attendances[0].courseSlot, attendances[1].courseSlot],
      false
    );
    sinon.assert.calledWithExactly(getTotalDuration.getCall(1), [attendances[2].courseSlot], false);
    sinon.assert.calledWithExactly(
      getPdf.getCall(0),
      {
        duration: { onSite: '6h30', eLearning: '1h', total: '7h30' },
        learningGoals: 'Apprendre plein de trucs cool',
        programName: 'unprogramme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 1', attendanceDuration: '4h30', eLearningDuration: '1h', totalDuration: '5h30' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledWithExactly(
      getPdf.getCall(1),
      {
        duration: { onSite: '6h30', eLearning: '1h', total: '7h30' },
        learningGoals: 'Apprendre plein de trucs cool',
        programName: 'unprogramme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 2', attendanceDuration: '3h', eLearningDuration: '0h30', totalDuration: '3h30' },
        date: '20/01/2020',
      }
    );
    sinon.assert.calledOnceWithExactly(
      generateZip,
      'attestations_pdf.zip',
      [{ name: 'Attestation - trainee 1.pdf', file: 'pdf 1' }, { name: 'Attestation - trainee 2.pdf', file: 'pdf 2' }]
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name learningGoals' },
              {
                path: 'steps',
                select: 'type theoreticalDuration',
                match: { type: E_LEARNING },
                populate: {
                  path: 'activities',
                  populate: { path: 'activityHistories', match: { user: { $in: traineesIds } } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      attendanceFind,
      [
        { query: 'find', args: [{ courseSlot: course.slots.map(s => s._id), company: { $in: course.companies } }] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate' }] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]);
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: course.trainees }
    );
    sinon.assert.notCalled(createDocx);
    sinon.assert.notCalled(downloadFileById);
    sinon.assert.notCalled(createReadStream);
  });

  it('should download completion certificates from mobile', async () => {
    const companyId = new ObjectId();

    const credentials = { _id: new ObjectId(), company: { _id: companyId } };
    const courseId = new ObjectId();
    const traineesIds = [credentials._id, new ObjectId()];

    const course = {
      trainees: [
        { _id: traineesIds[0], identity: { lastname: 'trainee 1' } },
        { _id: traineesIds[1], identity: { lastname: 'trainee 2' } },
        { _id: traineesIds[2], identity: { lastname: 'trainee 3' } },
      ],
      misc: 'Bonjour je suis une formation',
      companies: [companyId],
      subProgram: {
        program: { learningGoals: 'Apprendre', name: 'nom du programme' },
        steps: [{
          type: E_LEARNING,
          theoreticalDuration: 'PT7200S',
          activities: [
            { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }, { user: traineesIds[1] }] },
            { _id: new ObjectId(), activityHistories: [{ user: traineesIds[0] }] },
          ],
        }],
      },
      slots: [
        { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
        { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      ],
    };
    const attendances = [
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
      {
        trainee: traineesIds[0],
        courseSlot: { startDate: '2022-01-21T12:00:00.000Z', endDate: '2022-01-21T13:30:00.000Z' },
      },
      {
        trainee: traineesIds[1],
        courseSlot: { startDate: '2022-01-18T07:00:00.000Z', endDate: '2022-01-18T10:00:00.000Z' },
      },
    ];

    attendanceFind.returns(SinonMongoose.stubChainedQueries(attendances, ['populate', 'setOptions', 'lean']));
    courseFindOne.onCall(0).returns(SinonMongoose.stubChainedQueries(
      {
        trainees: traineesIds,
        misc: 'Bonjour je suis une formation',
        trainer: new ObjectId(),
        companies: [companyId],
      },
      ['lean']
    ));
    courseFindOne.onCall(1).returns(SinonMongoose.stubChainedQueries(course));
    formatCourseForDocuments.returns({
      duration: { onSite: '6h30', eLearning: '2h', total: '8h30' },
      learningGoals: 'Apprendre',
      programName: 'nom du programme',
      startDate: '2022-01-18T07:00:00.000Z',
      endDate: '2022-01-21T13:30:00.000Z',
      steps: course.subProgram.steps,
    });
    formatIdentity.onCall(0).returns('trainee 1');
    getTotalDuration.onCall(0).returns('PT16200S');
    getPdf.returns('pdf');

    const params = { format: PDF, type: CUSTOM };
    const result = await CourseHelper.generateCompletionCertificates(courseId, credentials, params);

    expect(result).toEqual({ file: 'pdf', name: 'Attestation - trainee 1.pdf' });
    sinon.assert.calledOnceWithExactly(formatCourseForDocuments, course, CUSTOM);
    sinon.assert.calledOnceWithExactly(formatIdentity, { lastname: 'trainee 1' }, 'FL');
    sinon.assert.calledOnceWithExactly(getTotalDuration, [attendances[0].courseSlot, attendances[1].courseSlot], false);
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        duration: { onSite: '6h30', eLearning: '2h', total: '8h30' },
        learningGoals: 'Apprendre',
        programName: 'nom du programme',
        startDate: '2022-01-18T07:00:00.000Z',
        endDate: '2022-01-21T13:30:00.000Z',
        trainee: { identity: 'trainee 1', attendanceDuration: '4h30', eLearningDuration: '2h', totalDuration: '6h30' },
        date: '20/01/2020',
      }
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: courseId }, { trainees: 1 }] }, { query: 'lean' }],
      0
    );
    SinonMongoose.calledWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: courseId }] },
        { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate' }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        {
          query: 'populate',
          args: [{
            path: 'subProgram',
            select: 'program steps',
            populate: [
              { path: 'program', select: 'name learningGoals' },
              {
                path: 'steps',
                select: 'type theoreticalDuration',
                match: { type: E_LEARNING },
                populate: {
                  path: 'activities',
                  populate: { path: 'activityHistories', match: { user: { $in: traineesIds } } },
                },
              },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'lean' },
      ],
      1
    );
    SinonMongoose.calledOnceWithExactly(
      attendanceFind,
      [
        { query: 'find', args: [{ courseSlot: course.slots.map(s => s._id), company: { $in: course.companies } }] },
        { query: 'populate', args: [{ path: 'courseSlot', select: 'startDate endDate' }] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]);
    sinon.assert.notCalled(createDocx);
    sinon.assert.notCalled(createReadStream);
    sinon.assert.notCalled(generateZip);
    sinon.assert.notCalled(downloadFileById);
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
  });
});

describe('addAccessRule', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should add access rule to course', async () => {
    const courseId = new ObjectId();
    const payload = { company: new ObjectId() };

    await CourseHelper.addAccessRule(courseId, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: courseId }, { $push: { accessRules: payload.company } });
  });
});

describe('deleteAccessRule', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should add access rule to course', async () => {
    const courseId = new ObjectId();
    const accessRuleId = new ObjectId();

    await CourseHelper.deleteAccessRule(courseId, accessRuleId);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: courseId }, { $pull: { accessRules: accessRuleId } });
  });
});

describe('formatHoursForConvocation', () => {
  it('should format hours for convocation for 1 slot', () => {
    const slots = [{ startDate: '2020-10-12T12:30:00', endDate: '2020-10-12T14:30:00' }];

    const result = CourseHelper.formatHoursForConvocation(slots);

    expect(result).toEqual('12h30 - 14h30');
  });

  it('should format hours for convocation for 2 slots', () => {
    const slots = [
      { startDate: '2020-10-12T12:30:00', endDate: '2020-10-12T14:30:00' },
      { startDate: '2020-10-12T15:30:00', endDate: '2020-10-12T17:30:00' },
    ];

    const result = CourseHelper.formatHoursForConvocation(slots);

    expect(result).toEqual('12h30 - 14h30 / 15h30 - 17h30');
  });
});

describe('formatCourseForConvocationPdf', () => {
  let formatIdentity;
  let formatHoursForConvocation;
  let groupSlotsByDate;
  beforeEach(() => {
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
    formatHoursForConvocation = sinon.stub(CourseHelper, 'formatHoursForConvocation');
    groupSlotsByDate = sinon.stub(CourseHelper, 'groupSlotsByDate');
  });
  afterEach(() => {
    formatIdentity.restore();
    formatHoursForConvocation.restore();
    groupSlotsByDate.restore();
  });

  it('should return formatted course', async () => {
    const courseId = new ObjectId();
    const course = {
      _id: courseId,
      subProgram: { program: { name: 'Comment attraper des Pokemons' } },
      trainers: [
        { identity: { firstname: 'Ash', lastname: 'Ketchum' } },
        { identity: { firstname: 'Toto', lastname: 'Tata' } },
      ],
      contact: {
        identity: { firstname: 'Pika', lastname: 'CHU' },
        contact: { phone: '0123456789' },
        local: { email: 'pikachu@coucou.fr' },
      },
      slots: [
        {
          startDate: '2020-10-12T12:30:00',
          endDate: '2020-10-12T13:30:00',
          address: { fullAddress: '3 rue T' },
        },
        {
          startDate: '2020-10-14T17:30:00',
          endDate: '2020-10-14T19:30:00',
          meetingLink: 'http://eelslap.com/',
        },
      ],
    };

    formatIdentity.onCall(0).returns('Pika CHU');
    formatIdentity.onCall(1).returns('Ash KETCHUM');
    formatIdentity.onCall(2).returns('Toto TATA');
    formatHoursForConvocation.onCall(0).returns('13:30 - 14:30');
    formatHoursForConvocation.onCall(1).returns('18:30 - 20:30');
    groupSlotsByDate.returns([
      [{
        startDate: '2020-10-12T12:30:00',
        endDate: '2020-10-12T13:30:00',
        address: { fullAddress: '3 rue T' },
      }],
      [{
        startDate: '2020-10-14T17:30:00',
        endDate: '2020-10-14T19:30:00',
        meetingLink: 'http://eelslap.com/',
      }],
    ]);

    const result = await CourseHelper.formatCourseForConvocationPdf(course);

    expect(result).toEqual({
      _id: courseId,
      subProgram: { program: { name: 'Comment attraper des Pokemons' } },
      trainers: [
        { identity: { firstname: 'Ash', lastname: 'Ketchum' }, formattedIdentity: 'Ash KETCHUM' },
        { identity: { firstname: 'Toto', lastname: 'Tata' }, formattedIdentity: 'Toto TATA' },
      ],
      contact: { formattedIdentity: 'Pika CHU', formattedPhone: '01 23 45 67 89', email: 'pikachu@coucou.fr' },
      slots: [
        { date: '12/10/2020', hours: '13:30 - 14:30', address: '3 rue T' },
        { date: '14/10/2020', hours: '18:30 - 20:30', meetingLink: 'http://eelslap.com/' },
      ],
    });

    sinon.assert.calledOnceWithExactly(
      groupSlotsByDate,
      [{
        startDate: '2020-10-12T12:30:00',
        endDate: '2020-10-12T13:30:00',
        address: { fullAddress: '3 rue T' },
      },
      {
        startDate: '2020-10-14T17:30:00',
        endDate: '2020-10-14T19:30:00',
        meetingLink: 'http://eelslap.com/',
      }]
    );
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { firstname: 'Pika', lastname: 'CHU' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { firstname: 'Ash', lastname: 'Ketchum' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { firstname: 'Toto', lastname: 'Tata' }, 'FL');
    sinon.assert.calledWithExactly(
      formatHoursForConvocation.getCall(0),
      [{ startDate: '2020-10-12T12:30:00', endDate: '2020-10-12T13:30:00', address: { fullAddress: '3 rue T' } }]
    );
    sinon.assert.calledWithExactly(
      formatHoursForConvocation.getCall(1),
      [{ startDate: '2020-10-14T17:30:00', endDate: '2020-10-14T19:30:00', meetingLink: 'http://eelslap.com/' }]
    );
  });
});

describe('generateConvocationPdf', () => {
  let formatCourseForConvocationPdf;
  let courseFindOne;
  let getPdf;
  beforeEach(() => {
    formatCourseForConvocationPdf = sinon.stub(CourseHelper, 'formatCourseForConvocationPdf');
    courseFindOne = sinon.stub(Course, 'findOne');
    getPdf = sinon.stub(CourseConvocation, 'getPdf');
  });
  afterEach(() => {
    formatCourseForConvocationPdf.restore();
    courseFindOne.restore();
    getPdf.restore();
  });

  it('should return pdf', async () => {
    const courseId = new ObjectId();

    courseFindOne.returns(SinonMongoose.stubChainedQueries(
      {
        _id: courseId,
        subProgram: { program: { name: 'Comment attraper des Pokemons' } },
        trainers: [
          { identity: { firstname: 'Ash', lastname: 'Ketchum' }, biography: 'Bio' },
          { identity: { firstname: 'Toto', lastname: 'Tata' } },
        ],
        contact: { phone: '0123456789' },
        slots: [{
          startDate: '2020-10-12T12:30:00.000+01:00',
          endDate: '2020-10-12T13:30:00.000+01:00',
          address: { fullAddress: '37 rue de Ponthieu 75005 Paris' },
        }],
      }
    ));

    formatCourseForConvocationPdf.returns({
      _id: courseId,
      subProgram: { program: { name: 'Comment attraper des Pokemons' } },
      trainers: [
        { identity: { firstname: 'Ash', lastname: 'Ketchum' }, formattedIdentity: 'Ash KETCHUM', biography: 'Bio' },
        { identity: { firstname: 'Toto', lastname: 'Tata' }, formattedIdentity: 'Toto TATA' },
      ],
      contact: { phone: '0123456789' },
      contactPhoneNumber: '01 23 45 67 89',
      slots: [{
        startDay: '12 oct. 2020',
        hours: '13:30 - 14:30',
        address: { fullAddress: '37 rue de Ponthieu 75005 Paris' },
        length: 1,
        position: 1,
      }],
    });

    getPdf.returns('pdf');

    const result = await CourseHelper.generateConvocationPdf(courseId);

    expect(result).toEqual({ pdf: 'pdf', courseName: 'Comment-attraper-des-Pokemons' });
    SinonMongoose.calledOnceWithExactly(courseFindOne, [
      { query: 'findOne', args: [{ _id: courseId }, { misc: 1 }] },
      {
        query: 'populate',
        args: [{
          path: 'subProgram',
          select: 'program',
          populate: { path: 'program', select: 'name description' },
        }],
      },
      { query: 'populate', args: [{ path: 'slots', select: 'startDate endDate address meetingLink' }] },
      { query: 'populate', args: [{ path: 'slotsToPlan', select: '_id' }] },
      {
        query: 'populate',
        args: [{ path: 'contact', select: 'identity.firstname identity.lastname contact.phone local.email' }],
      },
      { query: 'populate', args: [{ path: 'trainers', select: 'identity.firstname identity.lastname biography' }] },
      { query: 'lean' },
    ]);
    sinon.assert.calledOnceWithExactly(
      formatCourseForConvocationPdf,
      {
        _id: courseId,
        subProgram: { program: { name: 'Comment attraper des Pokemons' } },
        trainers: [
          { identity: { firstname: 'Ash', lastname: 'Ketchum' }, biography: 'Bio' },
          { identity: { firstname: 'Toto', lastname: 'Tata' } },
        ],
        contact: { phone: '0123456789' },
        slots: [{
          startDate: '2020-10-12T12:30:00.000+01:00',
          endDate: '2020-10-12T13:30:00.000+01:00',
          address: { fullAddress: '37 rue de Ponthieu 75005 Paris' },
        }],
      }
    );
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        _id: courseId,
        subProgram: { program: { name: 'Comment attraper des Pokemons' } },
        trainers: [
          { identity: { firstname: 'Ash', lastname: 'Ketchum' }, formattedIdentity: 'Ash KETCHUM', biography: 'Bio' },
          { identity: { firstname: 'Toto', lastname: 'Tata' }, formattedIdentity: 'Toto TATA' },
        ],
        contact: { phone: '0123456789' },
        contactPhoneNumber: '01 23 45 67 89',
        slots: [{
          startDay: '12 oct. 2020',
          hours: '13:30 - 14:30',
          address: { fullAddress: '37 rue de Ponthieu 75005 Paris' },
          length: 1,
          position: 1,
        }],
      }
    );
  });
});

describe('getQuestionnaires', () => {
  let findQuestionnaire;
  beforeEach(() => {
    findQuestionnaire = sinon.stub(Questionnaire, 'find');
  });
  afterEach(() => {
    findQuestionnaire.restore();
  });

  it('should return questionnaires with answers', async () => {
    const credentials = { role: { vendor: { name: TRAINER } } };
    const courseId = new ObjectId();
    const questionnaires = [
      { name: 'test', type: EXPECTATIONS, historiesCount: 1 },
      { name: 'test2', type: EXPECTATIONS, historiesCount: 0 },
      {
        name: 'auto-eval',
        type: SELF_POSITIONNING,
        historiesCount: 1,
        histories: [{ timeline: END_COURSE, isValidated: true }],
      },
    ];

    findQuestionnaire.returns(SinonMongoose.stubChainedQueries(questionnaires, ['select', 'populate', 'lean']));

    const result = await CourseHelper.getQuestionnaires(courseId, credentials);

    expect(result).toMatchObject([questionnaires[0], questionnaires[2]]);
    SinonMongoose.calledOnceWithExactly(
      findQuestionnaire,
      [
        { query: 'find', args: [{ status: { $ne: DRAFT } }] },
        { query: 'select', args: ['type name'] },
        {
          query: 'populate',
          args: [{
            path: 'historiesCount',
            match: { course: courseId, questionnaireAnswersList: { $ne: [] } },
            options: { isVendorUser: true },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            select: 'timeline isValidated',
            match: { course: courseId, questionnaireAnswersList: { $ne: [] }, timeline: END_COURSE },
            options: { isVendorUser: true },
          }],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('addCourseCompany', () => {
  let courseUpdateOne;
  let createHistoryOnCompanyAddition;
  beforeEach(() => {
    courseUpdateOne = sinon.stub(Course, 'updateOne');
    createHistoryOnCompanyAddition = sinon.stub(CourseHistoriesHelper, 'createHistoryOnCompanyAddition');
  });
  afterEach(() => {
    courseUpdateOne.restore();
    createHistoryOnCompanyAddition.restore();
  });

  it('should add a course company using existing company', async () => {
    const companyId = new ObjectId();
    const course = { _id: new ObjectId(), misc: 'Test', companies: [new ObjectId()] };
    const payload = { company: companyId };
    const credentials = { _id: new ObjectId() };

    await CourseHelper.addCourseCompany(course._id, payload, credentials);

    sinon.assert.calledOnceWithExactly(courseUpdateOne, { _id: course._id }, { $addToSet: { companies: companyId } });
    sinon.assert.calledOnceWithExactly(
      createHistoryOnCompanyAddition,
      { course: course._id, company: companyId },
      credentials._id
    );
  });
});

describe('removeCourseCompany', () => {
  let courseUpdateOne;
  let findOneTrainingContract;
  let createHistoryOnCompanyDeletion;
  let deleteTrainingContract;

  beforeEach(() => {
    courseUpdateOne = sinon.stub(Course, 'updateOne');
    findOneTrainingContract = sinon.stub(TrainingContract, 'findOne');
    createHistoryOnCompanyDeletion = sinon.stub(CourseHistoriesHelper, 'createHistoryOnCompanyDeletion');
    deleteTrainingContract = sinon.stub(TrainingContractsHelper, 'delete');
  });

  afterEach(() => {
    courseUpdateOne.restore();
    findOneTrainingContract.restore();
    createHistoryOnCompanyDeletion.restore();
    deleteTrainingContract.restore();
  });

  it('should remove a course company', async () => {
    const companyId = new ObjectId();
    const course = { _id: new ObjectId(), misc: 'Test', companies: [companyId, new ObjectId()] };
    const credentials = { _id: new ObjectId() };
    const trainingContract = { _id: new ObjectId() };

    findOneTrainingContract.returns(SinonMongoose.stubChainedQueries(trainingContract, ['lean']));

    await CourseHelper.removeCourseCompany(course._id, companyId, credentials);

    sinon.assert.calledOnceWithExactly(courseUpdateOne, { _id: course._id }, { $pull: { companies: companyId } });
    sinon.assert.calledOnceWithExactly(
      createHistoryOnCompanyDeletion,
      { course: course._id, company: companyId },
      credentials._id
    );
    sinon.assert.calledOnceWithExactly(deleteTrainingContract, trainingContract._id);
    SinonMongoose.calledOnceWithExactly(
      findOneTrainingContract,
      [{ query: 'findOne', args: [{ course: course._id, company: companyId }, { _id: 1 }] }, { query: 'lean' }]
    );
  });
});

describe('generateTrainingContract', () => {
  let courseFindOne;
  let vendorCompanyGet;
  let trainingContractGetPdf;
  let getCompanyAtCourseRegistrationList;

  beforeEach(() => {
    courseFindOne = sinon.stub(Course, 'findOne');
    vendorCompanyGet = sinon.stub(VendorCompaniesHelper, 'get');
    trainingContractGetPdf = sinon.stub(TrainingContractPdf, 'getPdf');
    getCompanyAtCourseRegistrationList = sinon.stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
  });

  afterEach(() => {
    courseFindOne.restore();
    vendorCompanyGet.restore();
    trainingContractGetPdf.restore();
    getCompanyAtCourseRegistrationList.restore();
  });

  it('should download training contract for intra course with slots to plan & elearning and remote steps', async () => {
    const companyId = new ObjectId();
    const payload = { price: 12, company: companyId };
    const course = {
      _id: new ObjectId(),
      misc: 'Test',
      maxTrainees: 5,
      type: INTRA,
      trainees: [new ObjectId(), new ObjectId()],
      companies: [{
        _id: companyId,
        name: 'Alenvi',
        address: {
          fullAddress: '12 rue de ponthieu 75008 Paris',
          zipCode: '75008',
          city: 'Paris',
          street: '12 rue de Ponthieu',
        },
      }],
      subProgram: {
        program: { name: 'Programme', learningGoals: 'bien apprendre' },
        steps: [
          { theoreticalDuration: 'PT1200S', type: E_LEARNING },
          { theoreticalDuration: 'PT1200S', type: REMOTE },
          { theoreticalDuration: 'PT1200S', type: ON_SITE },
        ],
      },
      slots: [
        {
          startDate: '2020-11-03T09:00:00.000Z',
          endDate: '2020-11-03T11:00:00.000Z',
          address: { fullAddress: '14 rue de ponthieu 75008 Paris' },
        },
      ],
      slotsToPlan: [{ _id: new ObjectId() }],
      trainers: [
        { identity: { lastname: 'Bonbeur', firstname: 'Jean' } },
        { identity: { lastname: 'Pencil', firstname: 'James' } },
      ],
    };

    const vendorCompany = { name: 'Compani', address: { fullAddress: '140 rue de ponthieu 75008 Paris' } };

    const formattedCourse = {
      type: INTRA,
      vendorCompany,
      company: { name: 'Alenvi', address: '12 rue de ponthieu 75008 Paris' },
      programName: 'Programme',
      learningGoals: 'bien apprendre',
      slotsCount: 2,
      liveDuration: '0h40',
      eLearningDuration: '0h20',
      misc: 'Test',
      learnersCount: 5,
      dates: ['03/11/2020'],
      addressList: ['14 rue de ponthieu 75008 Paris', 'Cette formation contient des créneaux en distanciel'],
      trainers: ['Jean BONBEUR', 'James PENCIL'],
      price: 12,
    };

    vendorCompanyGet.returns(vendorCompany);

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    await CourseHelper.generateTrainingContract(course._id, payload);

    sinon.assert.calledOnceWithExactly(vendorCompanyGet);
    sinon.assert.calledOnceWithExactly(trainingContractGetPdf, formattedCourse);
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { maxTrainees: 1, misc: 1, type: 1, trainees: 1 }] },
        {
          query: 'populate',
          args: [[
            { path: 'companies', select: 'name address', match: { _id: companyId } },
            {
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name learningGoals' },
                { path: 'steps', select: 'theoreticalDuration type' },
              ],
            },
            { path: 'slots', select: 'startDate endDate address meetingLink' },
            { path: 'slotsToPlan', select: '_id' },
            { path: 'trainers', select: 'identity.firstname identity.lastname' },
          ]],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
  });

  it('should download training contract for inter course without slots to plan & only on_site steps', async () => {
    const companyId = new ObjectId();
    const payload = { price: 12, company: companyId };
    const course = {
      _id: new ObjectId(),
      misc: 'Test',
      type: INTER_B2B,
      trainees: [new ObjectId(), new ObjectId()],
      companies: [{
        _id: companyId,
        name: 'Alenvi',
        address: {
          fullAddress: '12 rue de ponthieu 75008 Paris',
          zipCode: '75008',
          city: 'Paris',
          street: '12 rue de Ponthieu',
        },
      }],
      subProgram: {
        program: { name: 'Programme', learningGoals: 'bien apprendre' },
        steps: [
          { theoreticalDuration: 'PT1200S', type: ON_SITE },
          { theoreticalDuration: 'PT1200S', type: ON_SITE },
          { theoreticalDuration: 'PT1200S', type: ON_SITE },
        ],
      },
      slots: [
        {
          startDate: '2020-11-05T09:00:00.000Z',
          endDate: '2020-11-05T11:00:00.000Z',
          address: { city: 'Paris', fullAddress: '14 rue de ponthieu 75008 Paris' },
        },
        {
          startDate: '2020-11-03T09:00:00.000Z',
          endDate: '2020-11-03T11:00:00.000Z',
          address: { city: 'Paris', fullAddress: '34 rue de ponthieu 75008 Paris' },
        },
        {
          startDate: '2020-11-04T09:00:00.000Z',
          endDate: '2020-11-04T11:00:00.000Z',
          address: { city: 'Paris', fullAddress: '24 rue de ponthieu 75008 Paris' },
        },
      ],
      slotsToPlan: [],
      trainers: [{ identity: { lastname: 'Bonbeur', firstname: 'Jean' } }],
    };

    const vendorCompany = { name: 'Compani', address: { fullAddress: '140 rue de ponthieu 75008 Paris' } };

    const formattedCourse = {
      type: INTER_B2B,
      vendorCompany,
      company: { name: 'Alenvi', address: '12 rue de ponthieu 75008 Paris' },
      programName: 'Programme',
      learningGoals: 'bien apprendre',
      slotsCount: 3,
      liveDuration: '6h',
      eLearningDuration: '',
      misc: 'Test',
      learnersCount: 1,
      dates: ['03/11/2020', '04/11/2020', '05/11/2020'],
      addressList: ['Paris'],
      trainers: ['Jean BONBEUR'],
      price: 12,
    };

    vendorCompanyGet.returns(vendorCompany);

    courseFindOne.returns(SinonMongoose.stubChainedQueries(course));

    getCompanyAtCourseRegistrationList.returns([
      { trainee: course.trainees[0], company: companyId },
      { trainee: course.trainees[1], company: new ObjectId() },
    ]);

    await CourseHelper.generateTrainingContract(course._id, payload);

    sinon.assert.calledOnceWithExactly(vendorCompanyGet);
    sinon.assert.calledOnceWithExactly(trainingContractGetPdf, formattedCourse);
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [
        { query: 'findOne', args: [{ _id: course._id }, { maxTrainees: 1, misc: 1, type: 1, trainees: 1 }] },
        {
          query: 'populate',
          args: [[
            { path: 'companies', select: 'name address', match: { _id: companyId } },
            {
              path: 'subProgram',
              select: 'program steps',
              populate: [
                { path: 'program', select: 'name learningGoals' },
                { path: 'steps', select: 'theoreticalDuration type' },
              ],
            },
            { path: 'slots', select: 'startDate endDate address meetingLink' },
            { path: 'slotsToPlan', select: '_id' },
            { path: 'trainers', select: 'identity.firstname identity.lastname' },
          ]],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: course._id },
      { key: TRAINEE, value: course.trainees }
    );
  });
});

describe('addTrainer', () => {
  let courseUpdateOne;

  beforeEach(() => {
    courseUpdateOne = sinon.stub(Course, 'updateOne');
  });

  afterEach(() => {
    courseUpdateOne.restore();
  });

  it('should add trainer to course', async () => {
    const trainerId = new ObjectId();
    const course = { _id: new ObjectId(), misc: 'Test', trainers: [new ObjectId()] };
    const payload = { trainer: trainerId };

    await CourseHelper.addTrainer(course._id, payload);

    sinon.assert.calledOnceWithExactly(courseUpdateOne, { _id: course._id }, { $addToSet: { trainers: trainerId } });
  });
});

describe('removeTrainer', () => {
  let courseUpdateOne;
  let trainerMissionFindOneAndUpdate;
  let courseFindOne;

  beforeEach(() => {
    trainerMissionFindOneAndUpdate = sinon.stub(TrainerMission, 'findOneAndUpdate');
    courseUpdateOne = sinon.stub(Course, 'updateOne');
    courseFindOne = sinon.stub(Course, 'findOne');
  });

  afterEach(() => {
    trainerMissionFindOneAndUpdate.restore();
    courseUpdateOne.restore();
    courseFindOne.restore();
  });

  it('should remove trainer and contact from course and cancelled trainerMission', async () => {
    const trainerId = new ObjectId();
    const course = { _id: new ObjectId(), misc: 'Test', trainers: [trainerId], contact: trainerId };
    const trainerMission = { _id: new ObjectId(), courses: [course._id], trainer: trainerId };

    trainerMissionFindOneAndUpdate.returns(
      SinonMongoose.stubChainedQueries({ ...trainerMission, cancelledAt: CompaniDate().startOf(DAY).toISO() }, ['lean'])
    );
    courseFindOne.returns(SinonMongoose.stubChainedQueries(course, ['lean']));

    await CourseHelper.removeTrainer(course._id, trainerId);

    SinonMongoose.calledOnceWithExactly(
      trainerMissionFindOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { courses: course._id, trainer: trainerId, cancelledAt: { $exists: false } },
            { $set: { cancelledAt: CompaniDate().startOf(DAY).toISO() } },
          ],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      courseFindOne,
      [{ query: 'findOne', args: [{ _id: course._id }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(
      courseUpdateOne,
      { _id: course._id },
      { $pull: { trainers: trainerId }, $unset: { contact: '' } }
    );
  });
});

describe('addTutor', () => {
  let courseUpdateOne;
  let emailAddTutor;

  beforeEach(() => {
    courseUpdateOne = sinon.stub(Course, 'updateOne');
    emailAddTutor = sinon.stub(EmailHelper, 'addTutor');
  });

  afterEach(() => {
    courseUpdateOne.restore();
    emailAddTutor.restore();
  });

  it('should add tutor to course', async () => {
    const tutorId = new ObjectId();
    const course = { _id: new ObjectId(), misc: 'Test', tutors: [new ObjectId()] };
    const payload = { tutor: tutorId };

    emailAddTutor.returns('email sent');

    const result = await CourseHelper.addTutor(course._id, payload);

    expect(result).toEqual('email sent');
    sinon.assert.calledOnceWithExactly(courseUpdateOne, { _id: course._id }, { $addToSet: { tutors: tutorId } });
    sinon.assert.calledOnceWithExactly(emailAddTutor, course._id, tutorId);
  });
});

describe('removeTutor', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(Course, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should remove tutor from course', async () => {
    const tutorId = new ObjectId();
    const course = { _id: new ObjectId(), misc: 'Test', tutors: [new ObjectId()] };

    await CourseHelper.removeTutor(course._id, tutorId);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: course._id }, { $pull: { tutors: tutorId } });
  });
});
