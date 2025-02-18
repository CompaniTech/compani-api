const path = require('path');
const get = require('lodash/get');
const has = require('lodash/has');
const isEmpty = require('lodash/isEmpty');
const omit = require('lodash/omit');
const groupBy = require('lodash/groupBy');
const keyBy = require('lodash/keyBy');
const mapValues = require('lodash/mapValues');
const set = require('lodash/set');
const fs = require('fs');
const os = require('os');
const Boom = require('@hapi/boom');
const { CompaniDate } = require('./dates/companiDates');
const Company = require('../models/Company');
const Course = require('../models/Course');
const User = require('../models/User');
const Questionnaire = require('../models/Questionnaire');
const QuestionnaireHistory = require('../models/QuestionnaireHistory');
const CourseSmsHistory = require('../models/CourseSmsHistory');
const Attendance = require('../models/Attendance');
const SubProgram = require('../models/SubProgram');
const TrainingContract = require('../models/TrainingContract');
const TrainerMission = require('../models/TrainerMission');
const CourseRepository = require('../repositories/CourseRepository');
const UtilsHelper = require('./utils');
const DatesUtilsHelper = require('./dates/utils');
const ZipHelper = require('./zip');
const SmsHelper = require('./sms');
const DocxHelper = require('./docx');
const StepsHelper = require('./steps');
const TrainingContractsHelper = require('./trainingContracts');
const drive = require('../models/Google/Drive');
const {
  INTRA,
  INTER_B2B,
  COURSE_SMS,
  STRICTLY_E_LEARNING,
  BLENDED,
  DRAFT,
  REJECTED,
  ON_SITE,
  E_LEARNING,
  WEBAPP,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  TRAINER,
  REMOTE,
  OPERATIONS,
  HHhMM,
  DD_MM_YYYY,
  HH_MM,
  PT0S,
  DAY,
  VENDOR_ROLES,
  COURSE,
  TRAINEE,
  PEDAGOGY,
  QUESTIONNAIRE,
  INTRA_HOLDING,
  ALL_WORD,
  PDF,
  CUSTOM,
  OFFICIAL,
  SHORT_DURATION_H_MM,
  END_COURSE,
  DAY_D_MONTH_YEAR,
  MOBILE,
  SINGLE,
} = require('./constants');
const CourseHistoriesHelper = require('./courseHistories');
const EmailHelper = require('./email');
const NotificationHelper = require('./notifications');
const VendorCompaniesHelper = require('./vendorCompanies');
const InterAttendanceSheet = require('../data/pdf/attendanceSheet/interAttendanceSheet');
const IntraAttendanceSheet = require('../data/pdf/attendanceSheet/intraAttendanceSheet');
const CourseConvocation = require('../data/pdf/courseConvocation');
const CompletionCertificate = require('../data/pdf/completionCertificate');
const TrainingContractPdf = require('../data/pdf/trainingContract');
const CourseBill = require('../models/CourseBill');
const CourseSlot = require('../models/CourseSlot');
const CourseHistory = require('../models/CourseHistory');
const { CompaniDuration } = require('./dates/companiDurations');

exports.createCourse = async (payload, credentials) => {
  const coursePayload = payload.company
    ? { ...omit(payload, 'company'), companies: [payload.company] }
    : payload;

  const course = await Course.create(coursePayload);

  if (course.estimatedStartDate) {
    await CourseHistoriesHelper.createHistoryOnEstimatedStartDateEdition(
      course._id,
      credentials._id,
      payload.estimatedStartDate
    );
  }

  const subProgram = await SubProgram
    .findOne({ _id: course.subProgram }, { steps: 1 })
    .populate({ path: 'steps', select: '_id type' })
    .lean();

  const slots = subProgram.steps
    .filter(step => [ON_SITE, REMOTE].includes(step.type))
    .map(step => ({ course: course._id, step: step._id }));

  if (slots.length) await CourseSlot.insertMany(slots);

  return course;
};

exports.getTotalTheoreticalDuration = course => (course.subProgram.steps.length
  ? course.subProgram.steps.reduce(
    (acc, value) => (value.theoreticalDuration ? acc.add(value.theoreticalDuration) : acc),
    CompaniDuration()
  ).toISO()
  : PT0S
);

const listStrictlyElearningForCompany = async (query, origin) => {
  const courses = await CourseRepository.findCourseAndPopulate(
    { ...omit(query, 'company'), accessRules: { $in: [query.company, []] } },
    origin
  );

  return courses.map(course => ({
    ...course,
    totalTheoreticalDuration: exports.getTotalTheoreticalDuration(course),
    trainees: course.trainees.filter(t =>
      (t.company ? UtilsHelper.areObjectIdsEquals(t.company._id, query.company) : false)),
  }));
};

const listBlendedForCompany = async (query, origin) => {
  const courses = await CourseRepository.findCourseAndPopulate(
    { ...omit(query, ['company']), companies: query.company },
    origin,
    true
  );

  // We sort courses by _id to have a consistent sort in the kanban even for two courses with same lastSlot's startDate
  const intraOrSingleCourses = courses
    .filter(course => [INTRA, SINGLE].includes(course.type))
    .sort((a, b) => UtilsHelper.sortStrings(a._id.toHexString(), b._id.toHexString()));
  const interOrIntraHoldingCourses = courses
    .filter(course => [INTER_B2B, INTRA_HOLDING].includes(course.type))
    .sort((a, b) => UtilsHelper.sortStrings(a._id.toHexString(), b._id.toHexString()));

  const traineesCompanyForCourseList = {};
  for (const course of interOrIntraHoldingCourses) {
    const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper
      .getCompanyAtCourseRegistrationList({ key: COURSE, value: course._id }, { key: TRAINEE, value: course.trainees });
    const traineesCompany = mapValues(keyBy(traineesCompanyAtCourseRegistration, 'trainee'), 'company');

    traineesCompanyForCourseList[course._id] = traineesCompany;
  }

  return [
    ...intraOrSingleCourses,
    ...interOrIntraHoldingCourses
      .map(course => ({
        ...course,
        trainees: course.trainees
          .filter(tId => UtilsHelper.areObjectIdsEquals(traineesCompanyForCourseList[course._id][tId], query.company)),
      })),
  ];
};

const formatQuery = (query, credentials) => {
  const formattedQuery = omit(query, ['isArchived', 'holding', 'trainer']);

  if (has(query, 'isArchived')) set(formattedQuery, 'archivedAt', { $exists: !!query.isArchived });

  if (has(query, 'holding')) {
    set(formattedQuery, '$or', [{ companies: { $in: credentials.holding.companies } }, { holding: query.holding }]);
  }

  if (has(query, 'trainer')) set(formattedQuery, 'trainers', query.trainer);

  return formattedQuery;
};

const formatCourseStepsList = (course) => {
  if (course.subProgram.isStrictlyELearning) return [];

  const courseName = get(course, 'subProgram.program.name');
  const courseMisc = course.misc || '';
  const courseSteps = get(course, 'subProgram.steps');
  const stepSlotsList = groupBy(course.slots.filter(s => get(s, 'step._id')), s => s.step._id);

  return Object.entries(stepSlotsList)
    .filter(([, stepSlots]) => !!stepSlots.find(slot => CompaniDate().isBefore(slot.endDate)))
    .map(([stepId, stepSlots]) => {
      const nextSlot = stepSlots.find(slot => CompaniDate().isBefore(slot.endDate));
      const slotsSorted = stepSlots.sort(DatesUtilsHelper.ascendingSortBy('endDate'));
      const stepIndex = courseSteps.map(step => step._id.toHexString()).indexOf(stepId);

      return {
        name: courseName,
        misc: courseMisc,
        stepIndex,
        nextSlot: nextSlot.endDate,
        type: nextSlot.step.type,
        slots: slotsSorted.map(s => s.endDate),
        _id: slotsSorted[0]._id,
        progress: courseSteps[stepIndex].progress,
        courseId: course._id,
      };
    });
};

const listForOperations = async (query, origin, credentials) => {
  if (query.company && query.format === STRICTLY_E_LEARNING) {
    return listStrictlyElearningForCompany(query, origin);
  }
  const formattedQuery = formatQuery(query, credentials);
  if (query.company) return listBlendedForCompany(formattedQuery, origin);

  const courses = await CourseRepository.findCourseAndPopulate(formattedQuery, origin);

  if (query.format === STRICTLY_E_LEARNING) {
    return courses
      .map(course => ({ ...course, totalTheoreticalDuration: exports.getTotalTheoreticalDuration(course) }));
  }

  if (origin === MOBILE) {
    return {
      courses: courses.sort((a, b) => UtilsHelper.sortStrings(a._id.toHexString(), b._id.toHexString())),
      nextSteps: courses.map(formatCourseStepsList)
        .flat()
        .filter(step => step.slots && step.slots.length)
        .sort(DatesUtilsHelper.ascendingSortBy('nextSlot')),
    };
  }

  return courses.sort((a, b) => UtilsHelper.sortStrings(a._id.toHexString(), b._id.toHexString()));
};

const listForPedagogy = async (query, origin, credentials) => {
  const traineeOrTutorId = query.trainee || get(credentials, '_id');
  const shouldQueryCompanies = !!query.holding || !!query.company;
  const companies = [];
  if (query.holding) companies.push(...credentials.holding.companies);
  if (query.company) companies.push(query.company);

  const courses = await Course.find(
    {
      $and: [
        { $or: [{ trainees: traineeOrTutorId }, { tutors: traineeOrTutorId }] },
        {
          $or: [
            {
              format: STRICTLY_E_LEARNING,
              ...(shouldQueryCompanies && { $or: [{ accessRules: [] }, { accessRules: { $in: companies } }] }),
            },
            { format: BLENDED, ...(shouldQueryCompanies && { companies: { $in: companies } }) },
          ],
        },
      ],
    },
    { _id: 1, tutors: 1 }
  )
    .lean();

  const traineeCourseIds = [];
  const tutorCourseIds = [];
  courses.forEach((course) => {
    if (UtilsHelper.doesArrayIncludeId(course.tutors, traineeOrTutorId)) tutorCourseIds.push(course._id);
    else traineeCourseIds.push(course._id);
  });

  let traineeCourses = [];
  let tutorCourses = [];

  if (traineeCourseIds.length) {
    traineeCourses = await Course
      .find({ _id: { $in: traineeCourseIds } }, { _id: 1, misc: 1, type: 1, format: 1 })
      .populate({
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
      })
      .populate({
        path: 'slots',
        select: 'startDate endDate step',
        populate: [
          { path: 'step', select: 'type' },
          {
            path: 'attendances',
            match: { trainee: traineeOrTutorId, ...(shouldQueryCompanies && { company: { $in: companies } }) },
            options: {
              isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                .includes(get(credentials, 'role.vendor.name')),
              requestingOwnInfos: UtilsHelper.areObjectIdsEquals(traineeOrTutorId, credentials._id),
            },
          },
        ],
      })
      .lean({ autopopulate: true, virtuals: true });
  }

  if (tutorCourseIds.length) {
    tutorCourses = await Course
      .find({ _id: { $in: tutorCourseIds } }, { _id: 1, misc: 1, type: 1, format: 1, tutors: 1 })
      .populate({
        path: 'subProgram',
        select: 'program steps',
        populate: [
          { path: 'program', select: 'name image description' },
          { path: 'steps', select: 'type theoreticalDuration' },
        ],
      })
      .lean();
  }

  let filteredTraineeCourses = traineeCourses;
  if (shouldQueryCompanies) {
    const companyAtCourseRegistration = await CourseHistoriesHelper.getCompanyAtCourseRegistrationList(
      { key: TRAINEE, value: traineeOrTutorId }, { key: COURSE, value: courses.map(course => course._id) }
    );
    const traineeCompanies = mapValues(keyBy(companyAtCourseRegistration, 'course'), 'company');
    filteredTraineeCourses = traineeCourses
      .filter(course => course.format === STRICTLY_E_LEARNING ||
        UtilsHelper.doesArrayIncludeId(companies, traineeCompanies[course._id]));
  }

  const shouldComputePresence = true;

  const onGoing = [];
  const achieved = [];
  const formattedTraineeCourses = filteredTraineeCourses
    .map((course) => {
      let progress = 0;
      const courseWithProgress = exports.formatCourseWithProgress(course, shouldComputePresence);

      if (origin === MOBILE) {
        if (courseWithProgress.format === STRICTLY_E_LEARNING) progress = courseWithProgress.progress.eLearning || 0;
        else progress = courseWithProgress.progress.blended || 0;
        if (progress < 1) onGoing.push(courseWithProgress);
        else achieved.push(courseWithProgress);
      }

      return courseWithProgress;
    });

  if (origin === MOBILE) {
    return {
      tutorCourses,
      traineeCourses: { onGoing, achieved },
      nextSteps: onGoing.map(formatCourseStepsList)
        .flat()
        .filter(step => step.slots && step.slots.length)
        .sort(DatesUtilsHelper.ascendingSortBy('nextSlot')),
    };
  }
  return { tutorCourses, traineeCourses: formattedTraineeCourses };
};

exports.list = async (query, credentials) => {
  const filteredQuery = omit(query, ['origin', 'action']);
  return query.action === OPERATIONS
    ? listForOperations(filteredQuery, query.origin, credentials)
    : listForPedagogy(filteredQuery, query.origin, credentials);
};

exports.getCourseProgress = (steps) => {
  if (!steps || !steps.length) return {};

  const blendedStepsCombinedProgress = steps
    .map(step => (has(step, 'progress.live') ? step.progress.live : step.progress.eLearning))
    .reduce((acc, value) => acc + value, 0);

  const elearningProgressSteps = steps.filter(step => has(step, 'progress.eLearning'));
  const eLearningStepsCombinedProgress = elearningProgressSteps
    .map(step => step.progress.eLearning)
    .reduce((acc, value) => acc + value, 0);

  const presenceProgressSteps = steps.filter(step => step.progress.presence);
  const combinedPresenceProgress = presenceProgressSteps.length
    ? {
      attendanceDuration: presenceProgressSteps
        .map(step => step.progress.presence.attendanceDuration)
        .reduce((acc, attendanceDuration) => acc.add(attendanceDuration), CompaniDuration())
        .toISO(),
      maxDuration: presenceProgressSteps
        .map(step => step.progress.presence.maxDuration)
        .reduce((acc, maxDuration) => acc.add(maxDuration), CompaniDuration())
        .toISO(),
    }
    : null;

  return {
    blended: blendedStepsCombinedProgress / steps.length,
    ...(elearningProgressSteps.length && { eLearning: eLearningStepsCombinedProgress / elearningProgressSteps.length }),
    ...(combinedPresenceProgress && { presence: combinedPresenceProgress }),
  };
};

exports.formatCourseWithProgress = (course, shouldComputePresence = false, shouldformatSlots = false) => {
  const slotsGroupedByStep = groupBy(course.slots, 'step._id');
  const steps = course.subProgram.steps
    .map((step) => {
      const slots = slotsGroupedByStep[step._id] || [];

      return { ...step, slots, progress: StepsHelper.getProgress(step, slots, shouldComputePresence) };
    });

  return {
    ...course,
    ...shouldformatSlots && {
      slots: [...new Set(
        course.slots.map(slot => UtilsHelper.capitalize(CompaniDate(slot.startDate).format(DAY_D_MONTH_YEAR)))
      )],
    },
    subProgram: { ...course.subProgram, steps },
    progress: exports.getCourseProgress(steps),
  };
};

const getCourseForOperations = async (courseId, credentials, origin) => {
  const isRofOrAdmin = [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(get(credentials, 'role.vendor.name'));

  const fetchedCourse = await Course.findOne({ _id: courseId })
    .populate([
      {
        path: 'companies',
        select: 'name',
        ...(origin === WEBAPP && { populate: { path: 'holding', populate: { path: 'holding', select: 'name' } } }),
      },
      {
        path: 'trainees',
        select: 'identity.firstname identity.lastname local.email contact picture.link '
          + 'firstMobileConnectionDate loginCode',
        populate: { path: 'company' },
      },
      {
        path: 'companyRepresentative',
        select: 'identity.firstname identity.lastname contact local.email picture.link',
      },
      {
        path: 'subProgram',
        select: 'program steps',
        populate: [
          { path: 'program', select: 'name learningGoals' },
          ...(origin === WEBAPP
            ? [{
              path: 'steps',
              select: 'name type theoreticalDuration',
              populate: {
                path: 'activities',
                select: 'name type',
                populate: { path: 'activityHistories', select: 'user' },
              },
            }]
            : [{ path: 'steps', select: 'name' }]
          ),
        ],
      },
      ...(origin === WEBAPP
        ? [
          {
            path: 'tutors',
            select: 'identity.firstname identity.lastname contact local.email picture.link '
              + 'firstMobileConnectionDate loginCode',
          },
          { path: 'slots', select: 'step startDate endDate address meetingLink' },
          { path: 'slotsToPlan', select: '_id step' },
          {
            path: 'trainers',
            select: 'identity.firstname identity.lastname contact local.email picture.link',
          },
          { path: 'accessRules', select: 'name' },
          {
            path: 'operationsRepresentative',
            select: 'identity.firstname identity.lastname contact local.email picture.link',
          },
          {
            path: 'salesRepresentative',
            select: 'identity.firstname identity.lastname contact local.email picture.link',
          },
          { path: 'contact', select: 'identity.firstname identity.lastname contact' },
          ...(isRofOrAdmin
            ? [{ path: 'trainerMissions', select: '_id trainer', options: { isVendorUser: true } }]
            : []),
        ]
        : [{ path: 'slots', select: 'step startDate endDate', options: { sort: { startDate: 1 } } }]
      ),
    ])
    .lean();

  let courseTrainees = fetchedCourse.trainees;
  const isBlended = fetchedCourse.format === BLENDED;
  if (isBlended) {
    const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper.getCompanyAtCourseRegistrationList(
      { key: COURSE, value: courseId }, { key: TRAINEE, value: fetchedCourse.trainees.map(t => t._id) }
    );

    const traineesCompany = mapValues(keyBy(traineesCompanyAtCourseRegistration, 'trainee'), 'company');
    courseTrainees = fetchedCourse.trainees
      .map(trainee => ({ ...trainee, registrationCompany: traineesCompany[trainee._id] }));
  }

  // A coach/client_admin is not supposed to read infos on trainees from other companies
  // espacially for INTER_B2B courses.
  return {
    ...fetchedCourse,
    totalTheoreticalDuration: exports.getTotalTheoreticalDuration(fetchedCourse),
    trainees: get(credentials, 'role.vendor')
      ? courseTrainees
      : courseTrainees.filter(t => UtilsHelper
        .hasUserAccessToCompany(credentials, get(t, isBlended ? 'registrationCompany' : 'company'))),
  };
};

const getCourseForQuestionnaire = async courseId => Course
  .findOne({ _id: courseId }, { subProgram: 1, type: 1, trainers: 1, trainees: 1, misc: 1 })
  .populate({ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] })
  .populate({ path: 'trainers', select: 'identity.firstname identity.lastname' })
  .populate({ path: 'trainees', select: 'identity.firstname identity.lastname local.email' })
  .lean({ virtuals: true });

exports.getCourse = async (query, params, credentials) => {
  switch (query.action) {
    case QUESTIONNAIRE:
      return getCourseForQuestionnaire(params._id);
    case OPERATIONS:
      return getCourseForOperations(params._id, credentials, query.origin);
    case PEDAGOGY:
      return _getCourseForPedagogy(params._id, credentials);
    default:
      return null;
  }
};

exports.selectUserHistory = (histories) => {
  const groupedHistories = Object.values(groupBy(histories, 'user'));

  return groupedHistories.map(userHistories => UtilsHelper.getLastVersion(userHistories, 'createdAt'));
};

exports.formatActivity = (activity) => {
  const followUp = {};
  const filteredHistories = exports.selectUserHistory(activity.activityHistories);
  for (const history of filteredHistories) {
    for (const answer of history.questionnaireAnswersList) {
      const { answerList } = answer;
      if (answerList.length === 1 && !answerList[0].trim()) continue;

      if (!followUp[answer.card._id]) followUp[answer.card._id] = { ...answer.card, answers: [] };
      followUp[answer.card._id].answers.push(
        ...answerList.map(a => ({ answer: a, trainee: history.user, history: history._id }))
      );
    }
  }

  return {
    ...activity,
    followUp: Object.values(followUp),
    activityHistories: activity.activityHistories.map(a => a._id),
  };
};

exports.formatStep = step => ({ ...step, activities: step.activities.map(a => exports.formatActivity(a)) });

exports.getCourseFollowUp = async (course, query, credentials) => {
  const companies = [];
  if (query.company) companies.push(query.company);
  if (query.holding) companies.push(...credentials.holding.companies);
  const courseWithTrainees = await Course.findOne({ _id: course }, { trainees: 1, format: 1 }).lean();

  const courseFollowUp = await Course.findOne({ _id: course }, { subProgram: 1 })
    .populate({
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
              match: { user: { $in: courseWithTrainees.trainees } },
              populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
            },
          },
        },
      ],
    })
    .populate({
      path: 'trainees',
      select: 'identity.firstname identity.lastname firstMobileConnectionDate loginCode',
      populate: { path: 'company' },
    })
    .lean();

  let filteredTrainees = [];
  if (!companies.length) filteredTrainees = courseFollowUp.trainees;
  else if (courseWithTrainees.format === STRICTLY_E_LEARNING) {
    filteredTrainees = courseFollowUp.trainees.filter(t => UtilsHelper.doesArrayIncludeId(companies, t.company));
  } else {
    const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper.getCompanyAtCourseRegistrationList(
      { key: COURSE, value: course }, { key: TRAINEE, value: courseFollowUp.trainees.map(t => t._id) }
    );
    const traineesCompany = mapValues(keyBy(traineesCompanyAtCourseRegistration, 'trainee'), 'company');
    filteredTrainees = courseFollowUp.trainees
      .filter(trainee => UtilsHelper.doesArrayIncludeId(companies, traineesCompany[trainee._id]));
  }

  return {
    ...courseFollowUp,
    subProgram: {
      ...courseFollowUp.subProgram,
      steps: courseFollowUp.subProgram.steps.map(s => exports.formatStep(s)),
    },
    trainees: exports.getTraineesWithElearningProgress(filteredTrainees, courseFollowUp.subProgram.steps),
  };
};

exports.getQuestionnaireAnswers = async (courseId) => {
  const course = await Course.findOne({ _id: courseId })
    .populate({
      path: 'subProgram',
      select: 'steps',
      populate: [
        {
          path: 'steps',
          select: 'activities',
          populate: {
            path: 'activities',
            populate: {
              path: 'activityHistories',
              populate: { path: 'questionnaireAnswersList.card', select: '-createdAt -updatedAt' },
            },
          },
        },
      ],
    })
    .lean();

  const courseActivities = get(course, 'subProgram.steps', []).map(step => step.activities).flat();
  const activitiesWithFollowUp = courseActivities.map(activity => exports.formatActivity(activity));

  return activitiesWithFollowUp.filter(act => act.followUp.length).map(act => act.followUp).flat();
};

const _computeTraineeElearningProgress = (traineeId, steps) => {
  const formattedSteps = steps
    .filter(step => step.type === E_LEARNING)
    .map((s) => {
      const traineeStep = {
        ...s,
        activities: s.activities.map(a => ({
          ...omit(a, 'groupedHistories'),
          activityHistories: a.groupedHistories[traineeId] || [],
        })),
      };

      return { ...traineeStep, progress: StepsHelper.getProgress(traineeStep) };
    });

  return { steps: formattedSteps, progress: exports.getCourseProgress(formattedSteps) };
};

exports.getTraineesWithElearningProgress = (trainees, steps) => {
  const stepsWithGroupedHistories = steps.map(s => ({
    ...s,
    activities: s.activities.map(a => ({ ...a, groupedHistories: groupBy(a.activityHistories, 'user') })),
  }));

  return trainees.map(t => ({ ...t, ..._computeTraineeElearningProgress(t._id, stepsWithGroupedHistories) }));
};

const _getCourseForPedagogy = async (courseId, credentials) => {
  const course = await Course.findOne({ _id: courseId })
    .populate({
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
              { path: 'activityHistories', match: { user: credentials._id } },
              { path: 'cards', select: 'template' },
            ],
          },
        },
      ],
    })
    .populate({
      path: 'slots',
      select: 'startDate endDate step address meetingLink',
      populate: { path: 'step', select: 'type' },
      options: { sort: { startDate: 1 } },
    })
    .populate({ path: 'trainers', select: 'identity.firstname identity.lastname biography picture' })
    .populate({ path: 'tutors', select: 'identity.firstname identity.lastname picture' })
    .populate({ path: 'contact', select: 'identity.firstname identity.lastname contact local.email' })
    .populate({
      path: 'attendanceSheets',
      match: { trainee: credentials._id },
      options: { requestingOwnInfos: true },
      populate: [{ path: 'slots', select: 'startDate endDate step' }, { path: 'trainer', select: 'identity' }],
    })
    .select('_id misc format')
    .lean({ autopopulate: true, virtuals: true });

  const courseTrainerIds = course.trainers ? course.trainers.map(trainer => trainer._id) : [];
  const isTrainer = UtilsHelper.doesArrayIncludeId(courseTrainerIds, credentials._id);
  const courseTutorIds = course.tutors ? course.tutors.map(tutor => tutor._id) : [];
  const isTutor = UtilsHelper.doesArrayIncludeId(courseTutorIds, credentials._id);
  if (isTrainer || isTutor) {
    const slotsGroupedByStep = groupBy(course.slots, 'step._id');

    return {
      ...course,
      slots: [...new Set(
        course.slots.map(slot => UtilsHelper.capitalize(CompaniDate(slot.startDate).format(DAY_D_MONTH_YEAR)))
      )],
      subProgram: {
        ...course.subProgram,
        steps: course.subProgram.steps.map((step) => {
          const slots = slotsGroupedByStep[step._id] || [];

          return {
            ...step,
            slots,
            activities: step.activities.map(activity => ({ ...omit(activity, 'activityHistories') })),
          };
        }),
      },
    };
  }

  if (!course.subProgram.isStrictlyELearning) {
    const lastSlot = course.slots[course.slots.length - 1];
    const areLastSlotAttendancesValidated = !!(lastSlot &&
      await Attendance.countDocuments({ courseSlot: lastSlot._id }));

    return { ...exports.formatCourseWithProgress(course, false, true), areLastSlotAttendancesValidated };
  }

  return exports.formatCourseWithProgress(course, false, true);
};

exports.updateCourse = async (courseId, payload, credentials) => {
  let setFields = payload;
  let unsetFields = {};

  if (has(payload, 'certifiedTrainees') && !payload.certifiedTrainees.length) {
    setFields = omit(setFields, 'certifiedTrainees');
    unsetFields = { ...unsetFields, certifiedTrainees: '' };
  }

  if (payload.archivedAt === '') {
    setFields = omit(setFields, 'archivedAt');
    unsetFields = { ...unsetFields, archivedAt: '' };
  }

  if (payload.salesRepresentative === '') {
    setFields = omit(setFields, 'salesRepresentative');
    unsetFields = { ...unsetFields, salesRepresentative: '' };
  }

  if (payload.contact === '') {
    setFields = omit(setFields, 'contact');
    unsetFields = { ...unsetFields, contact: '' };
  }

  const formattedPayload = {
    ...(!isEmpty(setFields) && { $set: { ...setFields } }),
    ...(!isEmpty(unsetFields) && { $unset: { ...unsetFields } }),
  };

  const courseFromDb = await Course.findOneAndUpdate({ _id: courseId }, formattedPayload).lean();

  const estimatedStartDateUpdated = payload.estimatedStartDate && (!courseFromDb.estimatedStartDate ||
    !CompaniDate(payload.estimatedStartDate).isSame(courseFromDb.estimatedStartDate, DAY));
  if (estimatedStartDateUpdated) {
    CourseHistoriesHelper.createHistoryOnEstimatedStartDateEdition(
      courseId,
      credentials._id,
      payload.estimatedStartDate,
      courseFromDb.estimatedStartDate
    );
  }

  return courseFromDb;
};

exports.deleteCourse = async (courseId) => {
  const trainingContractList = await TrainingContract
    .find({ course: courseId }, { _id: 1 })
    .setOptions({ isVendorUser: true })
    .lean();

  return Promise.all([
    Course.deleteOne({ _id: courseId }),
    CourseBill.deleteMany({
      course: courseId,
      $or: [{ billedAt: { $exists: false } }, { billedAt: { $not: { $type: 'date' } } }],
    }),
    CourseSmsHistory.deleteMany({ course: courseId }),
    QuestionnaireHistory.deleteMany({ course: courseId }),
    CourseHistory.deleteMany({ course: courseId }),
    CourseSlot.deleteMany({ course: courseId }),
    ...(trainingContractList.length
      ? [TrainingContractsHelper.deleteMany(trainingContractList.map(tc => tc._id))]
      : []
    ),
  ]);
};

exports.sendSMS = async (courseId, payload, credentials) => {
  const course = await Course.findById(courseId)
    .populate({ path: 'trainees', select: '_id contact' })
    .lean();

  const promises = [];
  const missingPhones = [];
  for (const trainee of course.trainees) {
    if (!get(trainee, 'contact.phone')) missingPhones.push(trainee._id);
    else {
      promises.push(SmsHelper.send({
        recipient: `${trainee.contact.countryCode}${trainee.contact.phone.substring(1)}`,
        sender: 'Compani',
        content: payload.content,
        tag: COURSE_SMS,
      }));
    }
  }

  const smsSentStatus = await Promise.allSettled(promises);
  if (!smsSentStatus.length) return;

  if (smsSentStatus.every(res => res.status === REJECTED)) throw Boom.badRequest(smsSentStatus[0].reason);
  else {
    await CourseSmsHistory.create({
      type: payload.type,
      course: courseId,
      message: payload.content,
      sender: credentials._id,
      missingPhones,
    });
  }
};

exports.getSMSHistory = async courseId => CourseSmsHistory.find({ course: courseId })
  .populate({ path: 'sender', select: 'identity.firstname identity.lastname' })
  .populate({ path: 'missingPhones', select: 'identity.firstname identity.lastname' })
  .lean();

exports.addTrainee = async (courseId, payload, credentials) => {
  const course = await Course.findOneAndUpdate(
    { _id: courseId },
    { $addToSet: { trainees: payload.trainee, ...(payload.isCertified && { certifiedTrainees: payload.trainee }) } },
    { projection: { companies: 1, type: 1 } }
  );

  const trainee = await User
    .findOne({ _id: payload.trainee }, { formationExpoTokenList: 1, firstMobileConnectionDate: 1, loginCode: 1 })
    .lean();

  if (!trainee.firstMobileConnectionDate && !trainee.loginCode) {
    const loginCode = String(Math.floor(Math.random() * 9000 + 1000));
    await User.updateOne({ _id: payload.trainee }, { loginCode });
  }

  await Promise.all([
    CourseHistoriesHelper.createHistoryOnTraineeAddition(
      {
        course: courseId,
        traineeId: trainee._id,
        company: course.type === INTRA ? course.companies[0] : payload.company,
      },
      credentials._id
    ),
    NotificationHelper.sendBlendedCourseRegistrationNotification(trainee, courseId),
  ]);
};

exports.registerToELearningCourse = async (courseId, credentials) =>
  Course.updateOne({ _id: courseId }, { $addToSet: { trainees: credentials._id } });

exports.removeCourseTrainee = async (courseId, traineeId, user) => Promise.all([
  CourseHistoriesHelper.createHistoryOnTraineeDeletion({ course: courseId, traineeId }, user._id),
  Course.updateOne({ _id: courseId }, { $pull: { trainees: traineeId, certifiedTrainees: traineeId } }),
]);

exports.formatIntraCourseSlotsForPdf = slot => ({
  startHour: CompaniDate(slot.startDate).format(HHhMM),
  endHour: CompaniDate(slot.endDate).format(HHhMM),
});

exports.formatInterCourseSlotsForPdf = (slot) => {
  const duration = UtilsHelper.getDuration(slot.startDate, slot.endDate);

  return {
    address: get(slot, 'address.fullAddress') || null,
    date: CompaniDate(slot.startDate).format(DD_MM_YYYY),
    startHour: CompaniDate(slot.startDate).format(HH_MM),
    endHour: CompaniDate(slot.endDate).format(HH_MM),
    duration,
  };
};

exports.groupSlotsByDate = (slots) => {
  const group = groupBy(slots, slot => CompaniDate(slot.startDate).format(DD_MM_YYYY));

  return Object.values(group).sort((a, b) => DatesUtilsHelper.ascendingSortBy('startDate')(a[0], b[0]));
};

exports.formatIntraCourseForPdf = (course) => {
  const possibleMisc = course.misc ? ` - ${course.misc}` : '';
  const name = course.subProgram.program.name + possibleMisc;
  const courseData = {
    name,
    duration: UtilsHelper.getTotalDuration(course.slots),
    company: UtilsHelper.formatName(course.companies),
    trainer: course.trainers.length === 1 ? UtilsHelper.formatIdentity(course.trainers[0].identity, 'FL') : '',
    type: course.type,
  };

  const filteredSlots = course.slots.filter(slot => slot.step.type === ON_SITE);
  const slotsGroupedByDate = exports.groupSlotsByDate(filteredSlots);

  return {
    dates: slotsGroupedByDate.map(groupedSlots => ({
      course: { ...courseData },
      address: get(groupedSlots[0], 'address.fullAddress') || '',
      slots: groupedSlots.map(slot => exports.formatIntraCourseSlotsForPdf(slot)),
      date: CompaniDate(groupedSlots[0].startDate).format(DD_MM_YYYY),
    })),
  };
};

exports.formatInterCourseForPdf = async (course) => {
  const possibleMisc = course.misc ? ` - ${course.misc}` : '';
  const name = course.subProgram.program.name + possibleMisc;
  const filteredSlots = course.slots
    ? course.slots.filter(slot => slot.step.type === ON_SITE).sort(DatesUtilsHelper.ascendingSortBy('startDate'))
    : [];

  const courseData = {
    name,
    slots: filteredSlots.map(exports.formatInterCourseSlotsForPdf),
    trainer: course.trainers.length === 1 ? UtilsHelper.formatIdentity(course.trainers[0].identity, 'FL') : '',
    firstDate: filteredSlots.length ? CompaniDate(filteredSlots[0].startDate).format(DD_MM_YYYY) : '',
    lastDate: filteredSlots.length
      ? CompaniDate(filteredSlots[filteredSlots.length - 1].startDate).format(DD_MM_YYYY)
      : '',
    duration: UtilsHelper.getTotalDuration(filteredSlots),
  };

  const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper
    .getCompanyAtCourseRegistrationList({ key: COURSE, value: course._id }, { key: TRAINEE, value: course.trainees });
  const traineesCompany = mapValues(keyBy(traineesCompanyAtCourseRegistration, 'trainee'), 'company');
  const companiesList = await Company
    .find({ _id: { $in: [...new Set(traineesCompanyAtCourseRegistration.map(t => t.company))] } }, { name: 1 })
    .lean();
  const companiesById = mapValues(keyBy(companiesList, '_id'), 'name');

  return {
    trainees: course.trainees.length
      ? course.trainees.map(trainee => ({
        traineeName: UtilsHelper.formatIdentity(trainee.identity, 'FL'),
        registrationCompany: companiesById[traineesCompany[trainee._id]],
        course: { ...courseData },
      }))
      : [{ traineeName: '', registrationCompany: '', course: { ...courseData } }],
  };
};

exports.generateAttendanceSheets = async (courseId) => {
  const course = await Course
    .findOne({ _id: courseId }, { misc: 1, type: 1 })
    .populate({ path: 'companies', select: 'name' })
    .populate({ path: 'slots', select: 'step startDate endDate address', populate: { path: 'step', select: 'type' } })
    .populate({ path: 'trainees', select: 'identity' })
    .populate({ path: 'trainers', select: 'identity' })
    .populate({ path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } })
    .lean();

  const pdf = [INTRA, INTRA_HOLDING].includes(course.type)
    ? await IntraAttendanceSheet.getPdf(exports.formatIntraCourseForPdf(course))
    : await InterAttendanceSheet.getPdf(await exports.formatInterCourseForPdf(course));

  return { fileName: 'emargement.pdf', pdf };
};

exports.formatCourseForDocuments = (course, type) => {
  const sortedCourseSlots = course.slots.sort(DatesUtilsHelper.ascendingSortBy('startDate'));

  const theoreticalDuration = course.subProgram.steps
    .reduce((acc, step) => acc.add(step.theoreticalDuration), CompaniDuration());

  const onSiteDuration = UtilsHelper.getTotalDuration(course.slots, false);

  const totalDuration = CompaniDuration(onSiteDuration)
    .add(CompaniDuration(theoreticalDuration))
    .format(SHORT_DURATION_H_MM);

  return {
    duration: {
      onSite: CompaniDuration(onSiteDuration).format(SHORT_DURATION_H_MM),
      eLearning: CompaniDuration(theoreticalDuration).format(SHORT_DURATION_H_MM),
      total: totalDuration,
    },
    learningGoals: get(course, 'subProgram.program.learningGoals') || '',
    programName: get(course, 'subProgram.program.name').toUpperCase() || '',
    startDate: CompaniDate(sortedCourseSlots[0].startDate).format(DD_MM_YYYY),
    endDate: CompaniDate(sortedCourseSlots[sortedCourseSlots.length - 1].endDate).format(DD_MM_YYYY),
    ...(type === OFFICIAL && { companyNamesById: mapValues(keyBy(course.companies, '_id'), 'name') }),
    steps: get(course, 'subProgram.steps'),
  };
};

const getELearningStepInfos = (step) => {
  const progress = step.activities.filter(activity => activity.activityHistories.length > 0).length;
  const maxProgress = step.activities.length;
  const stepProgress = maxProgress ? progress / maxProgress : 0;

  return { progress: stepProgress };
};

const getELearningDuration = (steps, traineeId) => {
  const formattedSteps = steps
    .map((step) => {
      const activities = step.activities
        .map(a => ({
          ...a,
          activityHistories: a.activityHistories.filter(aH => UtilsHelper.areObjectIdsEquals(aH.user, traineeId)),
        }));

      return { theoreticalDuration: step.theoreticalDuration, activities };
    });

  const eLearningDuration = formattedSteps.map((step) => {
    const { progress } = getELearningStepInfos(step);

    return progress ? progress * CompaniDuration(step.theoreticalDuration).asSeconds() : 0;
  }).reduce((acc, val) => acc.add(CompaniDuration({ seconds: val })), CompaniDuration());

  return eLearningDuration;
};

const getTraineeInformations = (trainee, courseAttendances, steps, companiesNames = null) => {
  const identity = UtilsHelper.formatIdentity(trainee.identity, 'FL');

  const traineeSlots = courseAttendances
    .filter(a => UtilsHelper.areObjectIdsEquals(trainee._id, a.trainee))
    .map(a => a.courseSlot);

  const attendanceDuration = UtilsHelper.getTotalDuration(traineeSlots, false);

  const eLearningDuration = getELearningDuration(steps, trainee._id);

  const totalDuration = CompaniDuration(attendanceDuration)
    .add(CompaniDuration(eLearningDuration))
    .format(SHORT_DURATION_H_MM);

  return {
    identity,
    attendanceDuration: CompaniDuration(attendanceDuration).format(SHORT_DURATION_H_MM),
    ...(companiesNames && { companyName: companiesNames[trainee.company] }),
    eLearningDuration: CompaniDuration(eLearningDuration).format(SHORT_DURATION_H_MM),
    totalDuration,
  };
};

const generateCompletionCertificatePdf = async (courseData, courseAttendances, trainee) => {
  const {
    identity,
    attendanceDuration,
    eLearningDuration,
    totalDuration,
  } = getTraineeInformations(trainee, courseAttendances, courseData.steps);

  const pdf = await CompletionCertificate.getPdf({
    ...omit(courseData, ['companyNamesById', 'steps']),
    trainee: { identity, attendanceDuration, eLearningDuration, totalDuration },
    date: CompaniDate().format(DD_MM_YYYY),
  });

  return { file: pdf, name: `Attestation - ${identity}.pdf` };
};

const generateOfficialCompletionCertificatePdf = async (courseData, courseAttendances, trainee) => {
  const {
    identity,
    attendanceDuration,
    companyName,
    eLearningDuration,
    totalDuration,
  } = getTraineeInformations(trainee, courseAttendances, courseData.steps, courseData.companyNamesById);

  const pdf = await CompletionCertificate.getPdf(
    {
      ...omit(courseData, ['companyNamesById', 'steps']),
      trainee: { identity, attendanceDuration, companyName, eLearningDuration, totalDuration },
      date: CompaniDate().format(DD_MM_YYYY),
    },
    OFFICIAL
  );

  return { file: pdf, name: `Certificat - ${identity}.pdf` };
};

const generateCompletionCertificateWord = async (course, attendances, trainee, templatePath, type) => {
  const {
    identity,
    attendanceDuration,
    companyName,
    eLearningDuration,
    totalDuration,
  } = getTraineeInformations(trainee, attendances, course.steps, course.companyNamesById);

  const filePath = await DocxHelper.createDocx(
    templatePath,
    {
      ...omit(course, ['companyNamesById', 'steps']),
      trainee: { identity, attendanceDuration, ...(companyName && { companyName }), eLearningDuration, totalDuration },
      date: CompaniDate().format(DD_MM_YYYY),
    }
  );

  const docType = type === OFFICIAL ? 'Certificat' : 'Attestation';
  return { name: `${docType} - ${identity}.docx`, file: fs.createReadStream(filePath) };
};

const getTraineeList = async (course, credentials) => {
  const isRofOrAdmin = [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(get(credentials, 'role.vendor.name'));
  const isCourseTrainer = get(credentials, 'role.vendor.name') === TRAINER &&
    UtilsHelper.doesArrayIncludeId(course.trainers, credentials._id);
  const canAccessAllTrainees = isRofOrAdmin || isCourseTrainer;

  const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper
    .getCompanyAtCourseRegistrationList({ key: COURSE, value: course._id }, { key: TRAINEE, value: course.trainees });
  const traineesCompany = mapValues(keyBy(traineesCompanyAtCourseRegistration, 'trainee'), 'company');

  const traineeList = course.trainees.map(t => ({ ...t, company: traineesCompany[t._id] }));
  if (canAccessAllTrainees) return traineeList;

  return traineeList.filter(trainee => UtilsHelper.hasUserAccessToCompany(credentials, trainee.company));
};

const generateCompletionCertificateAllWord = async (courseData, attendances, traineeList, type) => {
  const tmpFilePath = path.join(os.tmpdir(), 'certificate_template.docx');

  let fileId;
  if (type === CUSTOM) {
    fileId = courseData.duration.eLearning === '0h'
      ? process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_ID
      : process.env.GOOGLE_DRIVE_TRAINING_CERTIFICATE_TEMPLATE_WITH_ELEARNING_ID;
  } else {
    fileId = courseData.duration.eLearning === '0h'
      ? process.env.GOOGLE_DRIVE_OFFICIAL_TRAINING_CERTIFICATE_TEMPLATE_ID
      : process.env.GOOGLE_DRIVE_OFFICIAL_TRAINING_CERTIFICATE_TEMPLATE_WITH_ELEARNING_ID;
  }

  await drive.downloadFileById({ fileId, tmpFilePath });

  const promises = traineeList
    .map(t => generateCompletionCertificateWord(courseData, attendances, t, tmpFilePath, type));

  const fileName = type === CUSTOM ? 'attestations_word.zip' : 'certificats_word.zip';
  return ZipHelper.generateZip(fileName, await Promise.all(promises));
};

exports.generateCompletionCertificates = async (courseId, credentials, query) => {
  const { format, type } = query;

  const courseTrainees = await Course.findOne({ _id: courseId }, { trainees: 1 }).lean();

  const course = await Course.findOne({ _id: courseId })
    .populate({ path: 'slots', select: 'startDate endDate' })
    .populate({ path: 'trainees', select: 'identity' })
    .populate(
      {
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
              populate: { path: 'activityHistories', match: { user: { $in: courseTrainees.trainees } } },
            },
          },
        ],
      })
    .populate({ path: 'companies', select: 'name' })
    .lean();

  const attendances = await Attendance
    .find({ courseSlot: course.slots.map(s => s._id), company: { $in: course.companies } })
    .populate({ path: 'courseSlot', select: 'startDate endDate' })
    .setOptions({ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) })
    .lean();

  const courseData = exports.formatCourseForDocuments(course, type);
  if (format === PDF) {
    const trainee = course.trainees.find(t => UtilsHelper.areObjectIdsEquals(t._id, credentials._id));

    return generateCompletionCertificatePdf(courseData, attendances, trainee);
  }

  const traineeList = await getTraineeList(course, credentials);
  if (format === ALL_WORD) {
    return generateCompletionCertificateAllWord(courseData, attendances, traineeList, type, courseId);
  }

  if (type === OFFICIAL) {
    const promises = traineeList.map(t => generateOfficialCompletionCertificatePdf(courseData, attendances, t));
    return ZipHelper.generateZip('certificats_pdf.zip', await Promise.all(promises));
  }

  const promises = traineeList.map(t => generateCompletionCertificatePdf(courseData, attendances, t));
  return ZipHelper.generateZip('attestations_pdf.zip', await Promise.all(promises));
};

exports.addAccessRule = async (courseId, payload) => Course.updateOne(
  { _id: courseId },
  { $push: { accessRules: payload.company } }
);

exports.deleteAccessRule = async (courseId, accessRuleId) => Course.updateOne(
  { _id: courseId },
  { $pull: { accessRules: accessRuleId } }
);

exports.formatHoursForConvocation = slots => slots.reduce(
  (acc, slot) => {
    const slotHours = UtilsHelper.formatIntervalHourly(slot);

    return acc === '' ? slotHours : `${acc} / ${slotHours}`;
  },
  ''
);

exports.formatCourseForConvocationPdf = (course) => {
  const slotsGroupedByDate = exports.groupSlotsByDate(course.slots);

  const slots = slotsGroupedByDate.map(groupedSlots => ({
    ...(get(groupedSlots[0], 'address.fullAddress') && { address: get(groupedSlots[0], 'address.fullAddress') }),
    ...(groupedSlots[0].meetingLink && { meetingLink: groupedSlots[0].meetingLink }),
    hours: exports.formatHoursForConvocation(groupedSlots),
    date: CompaniDate(groupedSlots[0].startDate).format(DD_MM_YYYY),
  }));
  const contact = {
    formattedIdentity: UtilsHelper.formatIdentity(get(course, 'contact.identity'), 'FL'),
    email: get(course, 'contact.local.email'),
    formattedPhone: get(course, 'contact.contact.phone') ? UtilsHelper.formatPhone(course.contact.contact) : '',
  };
  const formattedTrainers = course.trainers.map(trainer => ({
    ...trainer,
    formattedIdentity: UtilsHelper.formatIdentity(trainer.identity, 'FL'),
  }));

  return { ...course, trainers: formattedTrainers, contact, slots };
};

exports.generateConvocationPdf = async (courseId) => {
  const course = await Course.findOne({ _id: courseId }, { misc: 1 })
    .populate({
      path: 'subProgram',
      select: 'program',
      populate: { path: 'program', select: 'name description' },
    })
    .populate({ path: 'slots', select: 'startDate endDate address meetingLink' })
    .populate({ path: 'slotsToPlan', select: '_id' })
    .populate({ path: 'contact', select: 'identity.firstname identity.lastname contact local.email' })
    .populate({ path: 'trainers', select: 'identity.firstname identity.lastname biography' })
    .lean();

  const courseName = get(course, 'subProgram.program.name', '').split(' ').join('-') || 'Formation';

  const pdf = await CourseConvocation.getPdf(exports.formatCourseForConvocationPdf(course));

  return { pdf, courseName };
};

exports.getQuestionnaires = async (courseId, credentials) => {
  const isVendorUser = !!get(credentials, 'role.vendor');
  const questionnaires = await Questionnaire.find({ status: { $ne: DRAFT } })
    .select('type name')
    .populate({
      path: 'historiesCount',
      match: { course: courseId, questionnaireAnswersList: { $ne: [] } },
      options: { isVendorUser },
    })
    .populate({
      path: 'histories',
      select: 'timeline isValidated',
      match: { course: courseId, questionnaireAnswersList: { $ne: [] }, timeline: END_COURSE },
      options: { isVendorUser },
    })
    .lean();

  return questionnaires.filter(questionnaire => questionnaire.historiesCount);
};

exports.addCourseCompany = async (courseId, payload, credentials) => {
  await Course.updateOne({ _id: courseId }, { $addToSet: { companies: payload.company } });

  await CourseHistoriesHelper.createHistoryOnCompanyAddition(
    { course: courseId, company: payload.company },
    credentials._id
  );
};

exports.removeCourseCompany = async (courseId, companyId, credentials) => {
  const trainingContract = await TrainingContract.findOne({ course: courseId, company: companyId }, { _id: 1 }).lean();

  return Promise.all([
    Course.updateOne({ _id: courseId }, { $pull: { companies: companyId } }),
    CourseHistoriesHelper.createHistoryOnCompanyDeletion({ course: courseId, company: companyId }, credentials._id),
    ...trainingContract ? [TrainingContractsHelper.delete(trainingContract._id)] : [],
  ]);
};

exports.generateTrainingContract = async (courseId, payload) => {
  const course = await Course
    .findOne({ _id: courseId }, { maxTrainees: 1, misc: 1, type: 1, trainees: 1 })
    .populate([
      { path: 'companies', select: 'name address', match: { _id: payload.company } },
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
    ])
    .lean();

  const vendorCompany = await VendorCompaniesHelper.get();
  const formattedCourse = await TrainingContractsHelper
    .formatCourseForTrainingContract(course, vendorCompany, payload.price);
  const pdf = await TrainingContractPdf.getPdf(formattedCourse);
  const fileName = `convention_${formattedCourse.programName}_${formattedCourse.company.name}.pdf`;

  return { fileName, pdf };
};

exports.composeCourseName = (course) => {
  const companyName = course.type === INTRA ? `${course.companies[0].name} - ` : '';
  const misc = course.misc ? ` - ${course.misc}` : '';

  return companyName + course.subProgram.program.name + misc;
};

exports.addTrainer = async (courseId, payload) => Course
  .updateOne({ _id: courseId }, { $addToSet: { trainers: payload.trainer } });

exports.removeTrainer = async (courseId, trainerId) => {
  await TrainerMission
    .findOneAndUpdate(
      { courses: courseId, trainer: trainerId, cancelledAt: { $exists: false } },
      { $set: { cancelledAt: CompaniDate().startOf(DAY).toISO() } }
    ).lean();

  const course = await Course.findOne({ _id: courseId }).lean();
  const trainerIsContact = UtilsHelper.areObjectIdsEquals(get(course, 'contact'), trainerId);

  const query = trainerIsContact
    ? { $pull: { trainers: trainerId }, $unset: { contact: '' } }
    : { $pull: { trainers: trainerId } };

  await Course.updateOne({ _id: courseId }, query);
};

exports.addTutor = async (courseId, payload) => {
  await Course.updateOne({ _id: courseId }, { $addToSet: { tutors: payload.tutor } });

  const tutor = await User
    .findOne({ _id: payload.tutor }, { firstMobileConnectionDate: 1, loginCode: 1 })
    .lean();

  if (!(tutor.firstMobileConnectionDate || tutor.loginCode)) {
    const loginCode = String(Math.floor(Math.random() * 9000 + 1000));
    await User.updateOne({ _id: payload.tutor }, { loginCode });
  }

  return EmailHelper.addTutor(courseId, payload.tutor);
};

exports.removeTutor = async (courseId, tutorId) => {
  await Course.updateOne({ _id: courseId }, { $pull: { tutors: tutorId } });
};
