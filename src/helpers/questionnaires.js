const get = require('lodash/get');
const pick = require('lodash/pick');
const QRCode = require('qrcode');
const Questionnaire = require('../models/Questionnaire');
const Course = require('../models/Course');
const Card = require('../models/Card');
const CardHelper = require('./cards');
const {
  EXPECTATIONS,
  PUBLISHED,
  STRICTLY_E_LEARNING,
  END_OF_COURSE,
  INTRA,
  SELF_POSITIONNING,
  START_COURSE,
  END_COURSE,
  DAY,
  BEFORE_MIDDLE_COURSE_END_DATE,
  BETWEEN_MID_AND_END_COURSE,
  ENDED,
  REVIEW,
} = require('./constants');
const DatesUtilsHelper = require('./dates/utils');
const UtilsHelper = require('./utils');
const { CompaniDate } = require('./dates/companiDates');

exports.create = async payload => Questionnaire.create(payload);

const getCourseTimeline = (course, userId) => {
  const sortedSlots = course.slots
    .filter(s => !userId || !s.trainees || UtilsHelper.doesArrayIncludeId(s.trainees, userId))
    .sort(DatesUtilsHelper.ascendingSortBy('startDate'));

  if (!sortedSlots.length) return BEFORE_MIDDLE_COURSE_END_DATE;

  const allSlots = [...sortedSlots, ...course.slotsToPlan];
  const middleSlotIndex = Math.ceil(allSlots.length / 2) - 1;
  if (!get(sortedSlots[middleSlotIndex], 'endDate')) return BEFORE_MIDDLE_COURSE_END_DATE;

  const isBeforeMiddleCourseEndDate = CompaniDate().isBefore(get(sortedSlots[middleSlotIndex], 'endDate'));
  if (isBeforeMiddleCourseEndDate) return BEFORE_MIDDLE_COURSE_END_DATE;

  if (get(course, 'slotsToPlan.length')) return BETWEEN_MID_AND_END_COURSE;

  const lastSlotStartOfDay = get(sortedSlots[sortedSlots.length - 1], 'startDate')
    ? CompaniDate(get(sortedSlots[sortedSlots.length - 1], 'startDate')).startOf(DAY)
    : null;
  if (CompaniDate().isAfter(lastSlotStartOfDay)) return ENDED;

  return BETWEEN_MID_AND_END_COURSE;
};

exports.getCourseInfos = async (courseId, userId) => {
  const course = await Course.findOne({ _id: courseId })
    .populate({ path: 'slots', select: '-__v -createdAt -updatedAt' })
    .populate({ path: 'slotsToPlan', select: '_id' })
    .populate({ path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id' } })
    .lean({ virtuals: true });

  return course.format === STRICTLY_E_LEARNING
    ? { isStrictlyELearning: true }
    : { programId: course.subProgram.program._id, courseTimeline: getCourseTimeline(course, userId) };
};

exports.list = async (credentials, query = {}) => {
  const isVendorUser = !!get(credentials, 'role.vendor');
  const { course: courseId } = query;

  if (!courseId) {
    return Questionnaire
      .find(query)
      .populate([{ path: 'historiesCount', options: { isVendorUser } }, { path: 'program', select: 'name' }])
      .lean();
  }

  const { isStrictlyELearning, programId } = await exports.getCourseInfos(courseId);

  if (isStrictlyELearning) return [];

  return Questionnaire
    .find({ $or: [{ program: { $exists: false } }, { program: programId }], status: PUBLISHED })
    .populate({ path: 'cards', select: '-__v -createdAt -updatedAt' })
    .lean();
};

exports.getQuestionnaire = async id => Questionnaire.findOne({ _id: id })
  .populate({ path: 'cards', select: '-__v -createdAt -updatedAt' })
  .lean({ virtuals: true });

exports.update = async (id, payload) => Questionnaire.findOneAndUpdate({ _id: id }, { $set: payload }).lean();

exports.addCard = async (questionnaireId, payload) => {
  const card = await CardHelper.createCard(payload);
  await Questionnaire.updateOne({ _id: questionnaireId }, { $push: { cards: card._id } });
};

exports.removeCard = async (cardId) => {
  const card = await Card.findOneAndDelete({ _id: cardId }, { 'media.publicId': 1 }).lean();
  await Questionnaire.updateOne({ cards: cardId }, { $pull: { cards: cardId } });
  if (get(card, 'media.publicId')) await CardHelper.deleteMedia(cardId, card.media.publicId);
};

const findQuestionnaires = (questionnaireConditions, historiesConditions) => {
  const { typeList, program } = questionnaireConditions;
  const { course, user, timeline } = historiesConditions;

  const findQuestionnaireQuery = {
    type: { $in: typeList },
    $or: [{ program: { $exists: false } }, { program }],
    status: PUBLISHED,
  };

  const matchHistoriesQuery = { course, user, $or: [{ timeline: { $exists: false } }, { timeline }] };

  return Questionnaire
    .find(findQuestionnaireQuery, { type: 1, name: 1 })
    .populate({
      path: 'histories',
      match: matchHistoriesQuery,
      options: { requestingOwnInfos: true },
      select: { _id: 1, timeline: 1 },
    })
    .populate({ path: 'cards', select: '-__v -createdAt -updatedAt' })
    .lean({ virtuals: true });
};

exports.getUserQuestionnaires = async (courseId, credentials) => {
  const { isStrictlyELearning, courseTimeline, programId } = await exports.getCourseInfos(courseId, credentials._id);

  if (isStrictlyELearning) return [];

  switch (courseTimeline) {
    case BETWEEN_MID_AND_END_COURSE:
      return [];
    case BEFORE_MIDDLE_COURSE_END_DATE:
    case ENDED: {
      const qType = courseTimeline === BEFORE_MIDDLE_COURSE_END_DATE ? [EXPECTATIONS] : [END_OF_COURSE];
      const timeline = courseTimeline === BEFORE_MIDDLE_COURSE_END_DATE ? START_COURSE : END_COURSE;

      const questionnaires = await findQuestionnaires(
        { typeList: [...qType, SELF_POSITIONNING], program: programId },
        { course: courseId, user: credentials._id, timeline }
      );

      return questionnaires.filter(q => q && !q.histories.length);
    }
  }

  return [];
};

const formatQuestionnaireAnswersWithCourse = async (courseId, questionnaireAnswers) => {
  const course = await Course.findOne({ _id: courseId })
    .select('subProgram companies misc type')
    .populate({ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] })
    .populate({ path: 'companies', select: 'name' })
    .lean();

  return {
    ...questionnaireAnswers,
    course: {
      programName: course.subProgram.program.name,
      companyName: course.type === INTRA ? course.companies[0].name : '',
      misc: course.misc,
    },
  };
};

const getFollowUpForReview = async (questionnaire, courseId) => {
  const fieldsToPick = ['user', 'questionnaireAnswersList', 'timeline', '_id', 'isValidated', 'trainerComment'];
  const followUp = questionnaire.histories.map(h => pick(h, fieldsToPick));

  const course = await Course.findOne({ _id: courseId })
    .select('subProgram companies misc type holding trainees')
    .populate({ path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] })
    .populate({ path: 'companies', select: 'name' })
    .populate({ path: 'holding', select: 'name' })
    .populate({ path: 'trainees', select: 'identity' })
    .lean();

  return { followUp, course };
};

const getFollowUpForList = async (questionnaire, courseId) => {
  const followUp = {};
  for (const history of questionnaire.histories) {
    for (const answer of history.questionnaireAnswersList) {
      const { answerList } = answer;
      if (answerList.length === 1 && !answerList[0].trim()) continue;

      if (!followUp[answer.card._id]) followUp[answer.card._id] = { ...answer.card, answers: [] };
      followUp[answer.card._id].answers
        .push(
          ...answerList.map(a => ({
            answer: a,
            course: history.course,
            traineeCompany: history.company,
            trainee: history.user,
            history: history._id,
            createdAt: history.createdAt,
            timeline: history.timeline,
          }))
        );
    }
  }

  const questionnaireAnswers = {
    questionnaire: { type: questionnaire.type, name: questionnaire.name },
    followUp: Object.values(followUp),
  };

  return courseId ? formatQuestionnaireAnswersWithCourse(courseId, questionnaireAnswers) : questionnaireAnswers;
};

exports.getFollowUp = async (questionnaireId, query, credentials) => {
  const isVendorUser = !!get(credentials, 'role.vendor');
  const { course, action } = query;

  const questionnaire = await Questionnaire.findOne({ _id: questionnaireId })
    .select('type name')
    .populate({
      path: 'histories',
      match: course ? { course } : null,
      options: { isVendorUser },
      select: '-__v -updatedAt',
      populate: [
        { path: 'questionnaireAnswersList.card', select: '-__v -createdAt -updatedAt' },
        {
          path: 'course',
          select: 'trainers subProgram misc companies type',
          populate: [
            { path: 'subProgram', select: 'program', populate: { path: 'program', select: '_id name' } },
            { path: 'companies', select: 'name' },
          ],
        },
      ],
    })
    .lean();

  return action === REVIEW
    ? getFollowUpForReview(questionnaire, course)
    : getFollowUpForList(questionnaire, course);
};

exports.generateQRCode = async (query) => {
  const { course: courseId, courseTimeline } = query;

  const qrCode = await QRCode
    .toDataURL(
      `${process.env.WEBSITE_HOSTNAME}/ni/questionnaires?courseId=${courseId}&courseTimeline=${courseTimeline}`,
      { margin: 0 });

  return qrCode;
};
