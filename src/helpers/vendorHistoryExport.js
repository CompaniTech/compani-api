const get = require('lodash/get');
const uniqBy = require('lodash/uniqBy');
const groupBy = require('lodash/groupBy');
const pick = require('lodash/pick');
const {
  NO_DATA,
  INTRA,
  ON_SITE,
  REMOTE,
  STEP_TYPES,
  EXPECTATIONS,
  END_OF_COURSE,
  OPEN_QUESTION,
  SURVEY,
  QUESTION_ANSWER,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  BILLING_DOCUMENTS,
  CREDIT_NOTE,
  BILL,
  PAYMENT_TYPES_LIST,
  PAYMENT_NATURE_LIST,
  DD_MM_YYYY,
  HH_MM_SS,
  DAY,
  ESTIMATED_START_DATE_EDITION,
  E_LEARNING,
  SELF_POSITIONNING,
  START_COURSE,
  END_COURSE,
} = require('./constants');
const { CompaniDate } = require('./dates/companiDates');
const DatesUtilsHelper = require('./dates/utils');
const UtilsHelper = require('./utils');
const NumbersHelper = require('./numbers');
const CourseBillHelper = require('./courseBills');
const CourseHelper = require('./courses');
const AttendanceSheet = require('../models/AttendanceSheet');
const CourseSmsHistory = require('../models/CourseSmsHistory');
const CourseSlot = require('../models/CourseSlot');
const CourseBill = require('../models/CourseBill');
const CourseCreditNote = require('../models/CourseCreditNote');
const CourseRepository = require('../repositories/CourseRepository');
const QuestionnaireHistory = require('../models/QuestionnaireHistory');
const CourseHistory = require('../models/CourseHistory');
const Questionnaire = require('../models/Questionnaire');
const CoursePayment = require('../models/CoursePayment');
const ActivityHistory = require('../models/ActivityHistory');
const Course = require('../models/Course');

const getEndOfCourse = (slotsGroupedByDate, slotsToPlan) => {
  if (slotsToPlan.length) return '';
  if (slotsGroupedByDate.length) {
    const lastDate = slotsGroupedByDate.length - 1;
    const lastSlot = slotsGroupedByDate[lastDate].length - 1;
    return CompaniDate(slotsGroupedByDate[lastDate][lastSlot].endDate).format(DD_MM_YYYY);
  }
  return '';
};

const getStartOfCourse = slotsGroupedByDate => (slotsGroupedByDate.length
  ? CompaniDate(slotsGroupedByDate[0][0].startDate).format(DD_MM_YYYY)
  : '');

const isSlotInInterval = (slot, startDate, endDate) => CompaniDate(slot.startDate).isAfter(startDate) &&
  CompaniDate(slot.endDate).isBefore(endDate);

const getAttendancesCountInfos = (course) => {
  const attendances = course.slots.map(slot => slot.attendances).flat();
  const courseTraineeList = course.trainees.map(trainee => trainee._id);
  const subscribedAttendances = attendances
    .filter(attendance => UtilsHelper.doesArrayIncludeId(courseTraineeList, attendance.trainee))
    .length;

  const upComingSlots = course.slots.filter(slot => CompaniDate().isBefore(slot.startDate)).length;
  const attendancesToCome = upComingSlots * course.trainees.length;

  const unsubscribedTrainees = uniqBy(attendances.map(a => a.trainee), trainee => trainee.toString())
    .filter(attendanceTrainee => !UtilsHelper.doesArrayIncludeId(courseTraineeList, attendanceTrainee))
    .length;

  return {
    subscribedAttendances,
    unsubscribedAttendances: attendances.length - subscribedAttendances,
    absences: (course.slots.length * course.trainees.length) - subscribedAttendances - attendancesToCome,
    unsubscribedTrainees,
    pastSlots: course.slots.length - upComingSlots,
  };
};

const getBillsInfos = (course) => {
  const validatedBillsWithoutCreditNote = course.bills.filter(bill => !bill.courseCreditNote && bill.billedAt);

  const payerList =
    [...new Set(validatedBillsWithoutCreditNote.map(bill => get(bill, 'payer.name')))]
      .sort((a, b) => a.localeCompare(b))
      .toString();
  const computedAmounts = validatedBillsWithoutCreditNote.map(bill => CourseBillHelper.computeAmounts(bill));
  const amountsInfos = validatedBillsWithoutCreditNote.length
    ? {
      netInclTaxes: computedAmounts.map(amount => amount.netInclTaxes).reduce((acc, value) => acc + value, 0),
      paid: computedAmounts.map(amount => amount.paid).reduce((acc, value) => acc + value, 0),
      total: computedAmounts.map(amount => amount.total).reduce((acc, value) => acc + value, 0),
    }
    : { netInclTaxes: '', paid: '', total: '' };

  if (course.type === INTRA) {
    const billsCountForExport = `${validatedBillsWithoutCreditNote.length} sur ${course.expectedBillsCount}`;
    const isBilled = !!course.expectedBillsCount &&
      validatedBillsWithoutCreditNote.length === course.expectedBillsCount;

    return { isBilled, billsCountForExport, payerList, ...amountsInfos };
  }

  const mainFeesCount = validatedBillsWithoutCreditNote
    .map(bill => bill.mainFee.count).reduce((acc, value) => acc + value, 0);
  const billsCountForExport = `${mainFeesCount} sur ${course.trainees.length}`;
  const isBilled = !!course.trainees.length && mainFeesCount === course.trainees.length;

  return { isBilled, billsCountForExport, payerList, ...amountsInfos };
};

const getProgress = (pastSlots, course) =>
  UtilsHelper.formatFloatForExport(pastSlots / (course.slots.length + course.slotsToPlan.length));

const getCourseCompletion = async (course) => {
  const courseActivitiesIds = course.subProgram.steps.map(s => s.activities).flat();
  const courseTraineesIds = course.trainees.map(t => t._id);
  const courseActivityHistories = await ActivityHistory
    .find({ $and: [{ activity: { $in: courseActivitiesIds }, user: { $in: courseTraineesIds } }] })
    .lean();
  const activityHistoriesGroupedByActivity = groupBy(courseActivityHistories, 'activity');
  const elearningSteps = course.subProgram.steps.filter(s => s.type === E_LEARNING);

  let totalStepProgress = 0;
  for (const step of elearningSteps) {
    let totalActivityProgress = 0;
    for (const activity of step.activities) {
      const traineesWithAH = Object.keys(groupBy(activityHistoriesGroupedByActivity[activity._id], 'user'));

      const activityAverageProgress = course.trainees.length
        ? NumbersHelper.divide(traineesWithAH.length, course.trainees.length)
        : 0;
      totalActivityProgress = NumbersHelper.add(totalActivityProgress, activityAverageProgress);
    }

    const stepAverageProgress = NumbersHelper.divide(totalActivityProgress, step.activities.length);
    totalStepProgress = NumbersHelper.add(totalStepProgress, stepAverageProgress);
  }
  return elearningSteps.length
    ? NumbersHelper.toFixedToFloat(NumbersHelper.divide(totalStepProgress, elearningSteps.length))
    : 0;
};

const formatTrainersName = courseTrainers => courseTrainers
  .map(trainer => UtilsHelper.formatIdentity(trainer.identity, 'FL'))
  .join(', ');

const formatCourseForExport = async (course, courseQH, smsCount, asCount, estimatedStartDateHistory) => {
  const slotsGroupedByDate = CourseHelper.groupSlotsByDate(course.slots);
  const {
    subscribedAttendances,
    unsubscribedAttendances,
    absences,
    unsubscribedTrainees,
    pastSlots,
  } = getAttendancesCountInfos(course);

  const expectactionQuestionnaireAnswers = courseQH
    .filter(qh => qh.questionnaire.type === EXPECTATIONS)
    .length;
  const endQuestionnaireAnswers = courseQH
    .filter(qh => qh.questionnaire.type === END_OF_COURSE)
    .length;

  const { isBilled, billsCountForExport, payerList, netInclTaxes, paid, total } = getBillsInfos(course);

  const companiesName = course.companies.map(co => co.name).sort((a, b) => a.localeCompare(b)).toString();

  const courseCompletion = await getCourseCompletion(course);

  return {
    Identifiant: course._id,
    Type: course.type,
    Payeur: payerList || '',
    Structure: companiesName || '',
    'Société mère': get(course, 'holding.name') || '',
    Programme: get(course, 'subProgram.program.name') || '',
    'Sous-Programme': get(course, 'subProgram.name') || '',
    'Infos complémentaires': course.misc,
    Intervenant·es: formatTrainersName(get(course, 'trainers', [])),
    'Début de formation': getStartOfCourse(slotsGroupedByDate),
    'Fin de formation': getEndOfCourse(slotsGroupedByDate, course.slotsToPlan),
    'Chargé des opérations': UtilsHelper.formatIdentity(get(course, 'operationsRepresentative.identity') || '', 'FL'),
    'Contact pour la formation': UtilsHelper.formatIdentity(get(course, 'contact.identity') || '', 'FL'),
    'Nombre d\'inscrits': get(course, 'trainees.length'),
    'Nombre de dates': slotsGroupedByDate.length,
    'Nombre de créneaux': get(course, 'slots.length'),
    'Nombre de créneaux à planifier': get(course, 'slotsToPlan.length'),
    'Durée Totale': UtilsHelper.getTotalDurationForExport(course.slots),
    'Nombre de SMS envoyés': smsCount,
    'Nombre de personnes connectées à l\'app': course.trainees
      .filter(trainee => trainee.firstMobileConnectionDate).length,
    'Complétion eLearning moyenne': UtilsHelper.formatFloatForExport(courseCompletion),
    'Nombre de réponses au questionnaire de recueil des attentes': expectactionQuestionnaireAnswers,
    'Nombre de réponses au questionnaire de satisfaction': endQuestionnaireAnswers,
    'Date de démarrage souhaitée': course.estimatedStartDate
      ? CompaniDate(course.estimatedStartDate).format(DD_MM_YYYY)
      : '',
    'Première date de démarrage souhaitée': estimatedStartDateHistory
      ? CompaniDate(estimatedStartDateHistory[0].update.estimatedStartDate.to).format(DD_MM_YYYY)
      : '',
    'Nombre de feuilles d\'émargement chargées': asCount,
    'Nombre de présences': subscribedAttendances,
    'Nombre d\'absences': absences,
    'Nombre de stagiaires non prévus': unsubscribedTrainees,
    'Nombre de présences non prévues': unsubscribedAttendances,
    Avancement: getProgress(pastSlots, course),
    Archivée: course.archivedAt ? 'Oui' : 'Non',
    'Date d\'archivage': course.archivedAt ? CompaniDate(course.archivedAt).format(DD_MM_YYYY) : '',
    'Nombre de factures': billsCountForExport,
    Facturée: isBilled ? 'Oui' : 'Non',
    'Montant facturé': UtilsHelper.formatFloatForExport(netInclTaxes),
    'Montant réglé': UtilsHelper.formatFloatForExport(paid),
    Solde: UtilsHelper.formatFloatForExport(total),
    'Date de création': CompaniDate(course.createdAt).format(DD_MM_YYYY),
  };
};

exports.exportCourseHistory = async (startDate, endDate, credentials) => {
  const slots = await CourseSlot.find({ startDate: { $lte: endDate }, endDate: { $gte: startDate } }).lean();
  const courseIdsFromSlots = slots.map(slot => slot.course);

  const courseIds = await CourseRepository.findCoursesIdsForExport(courseIdsFromSlots, startDate, endDate);

  if (!courseIds.length) return [[NO_DATA]];

  const cursor = await CourseRepository.findCoursesForExport(courseIds, credentials);

  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));
  const [questionnaireHistories, smsList, attendanceSheetList, estimatedStartDateHistories] = await Promise.all([
    QuestionnaireHistory
      .find({ course: { $in: courseIds } })
      .select('course questionnaire')
      .populate({ path: 'questionnaire', select: 'type' })
      .setOptions({ isVendorUser })
      .lean(),
    CourseSmsHistory.find({ course: { $in: courseIds } }).select('course').lean(),
    AttendanceSheet.find({ course: { $in: courseIds } }).select('course').setOptions({ isVendorUser }).lean(),
    CourseHistory.find(
      {
        course: { $in: courseIds },
        action: ESTIMATED_START_DATE_EDITION,
        update: { estimatedStartDate: { from: '' } },
      },
      { course: 1, update: 1 }
    ).lean(),
  ]);

  const rows = [];
  const groupedSms = groupBy(smsList, 'course');
  const grouppedAttendanceSheets = groupBy(attendanceSheetList, 'course');
  const groupedCourseQuestionnaireHistories = groupBy(questionnaireHistories, 'course');
  const groupedEstimatedStartDateHistories = groupBy(estimatedStartDateHistories, 'course');

  for (let course = await cursor.next(); course != null; course = await cursor.next()) {
    if (course.slots.length && !course.slots.some(slot => isSlotInInterval(slot, startDate, endDate))) continue;

    const smsCount = (groupedSms[course._id] || []).length;
    const asCount = (grouppedAttendanceSheets[course._id] || []).length;
    const courseQH = groupedCourseQuestionnaireHistories[course._id] || [];
    const estimatedStartDateHistory = groupedEstimatedStartDateHistories[course._id];

    rows.push(await formatCourseForExport(course, courseQH, smsCount, asCount, estimatedStartDateHistory));
  }

  return [Object.keys(rows[0]), ...rows.map(d => Object.values(d))];
};

const getAddress = (slot) => {
  if (get(slot, 'step.type') === ON_SITE) return get(slot, 'address.fullAddress') || '';
  if (get(slot, 'step.type') === REMOTE) return slot.meetingLink || '';

  return '';
};

exports.exportCourseSlotHistory = async (startDate, endDate, credentials) => {
  const cursor = await CourseSlot.find({ startDate: { $lte: endDate }, endDate: { $gte: startDate } })
    .populate({ path: 'step', select: 'type name' })
    .populate({
      path: 'course',
      select: 'type trainees misc subProgram companies',
      populate: [
        { path: 'companies', select: 'name' },
        { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
      ],
    })
    .populate({
      path: 'attendances',
      options: {
        isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
      },
    })
    .lean()
    .cursor();

  const rows = [];

  for (let slot = await cursor.next(); slot != null; slot = await cursor.next()) {
    const slotDuration = UtilsHelper.getDurationForExport(slot.startDate, slot.endDate);
    const subscribedAttendances = slot.attendances
      .filter(attendance => UtilsHelper.doesArrayIncludeId(slot.course.trainees, attendance.trainee))
      .length;

    rows.push({
      'Id Créneau': slot._id,
      'Id Formation': slot.course._id,
      Formation: CourseHelper.composeCourseName(slot.course),
      Étape: get(slot, 'step.name') || '',
      Type: STEP_TYPES[get(slot, 'step.type')] || '',
      'Date de création': CompaniDate(slot.createdAt).format(`${DD_MM_YYYY} ${HH_MM_SS}`) || '',
      'Date de début': CompaniDate(slot.startDate).format(`${DD_MM_YYYY} ${HH_MM_SS}`) || '',
      'Date de fin': CompaniDate(slot.endDate).format(`${DD_MM_YYYY} ${HH_MM_SS}`) || '',
      Durée: slotDuration,
      Adresse: getAddress(slot),
      'Nombre de présences': subscribedAttendances,
      'Nombre d\'absences': slot.course.trainees.length - subscribedAttendances,
      'Nombre de présences non prévues': slot.attendances.length - subscribedAttendances,
    });
  }

  return rows.length ? [Object.keys(rows[0]), ...rows.map(d => Object.values(d))] : [[NO_DATA]];
};

const _findAnswerText = (answers, answerId) => {
  const answer = answers.find(qa => UtilsHelper.areObjectIdsEquals(qa._id, answerId));

  return answer ? answer.text : '';
};

const _getAnswerForExport = (questionnaireCard, questionnaireHistoryAnswersList) => {
  const qAnswer = questionnaireHistoryAnswersList
    .find(qa => UtilsHelper.areObjectIdsEquals(qa.card._id, questionnaireCard._id));

  return qAnswer
    ? qAnswer.answerList
      .map(a => (UtilsHelper.isStringedObjectId(a) ? _findAnswerText(qAnswer.card.qcAnswers, a) : a))
      .join()
    : '';
};

exports.exportEndOfCourseQuestionnaireHistory = async (startDate, endDate, credentials) => {
  const rows = [];
  const isRofOrAdmin = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  const endOfCourseQuestionnaire = await Questionnaire
    .findOne({ type: END_OF_COURSE })
    .populate({ path: 'cards', select: 'question template' })
    .populate({
      path: 'histories',
      options: { isVendorUser: isRofOrAdmin },
      match: { createdAt: { $gte: startDate, $lte: endDate } },
      populate: [
        {
          path: 'course',
          select: 'subProgram',
          populate: [
            { path: 'subProgram', select: 'name program', populate: { path: 'program', select: 'name' } },
            { path: 'trainers', select: 'identity' },
          ],
        },
        { path: 'user', select: 'identity local.email contact.phone' },
        { path: 'company', select: 'name' },
        { path: 'questionnaireAnswersList.card', select: 'qcAnswers' },
      ],
    })
    .lean({ virtuals: true });

  for (const qHistory of endOfCourseQuestionnaire.histories) {
    const questionsAnswers = endOfCourseQuestionnaire.cards
      .filter(card => [OPEN_QUESTION, SURVEY, QUESTION_ANSWER].includes(card.template))
      .reduce((acc, card) => ({
        ...acc,
        [card.question]: _getAnswerForExport(card, qHistory.questionnaireAnswersList),
      }), {});

    const row = {
      'Id formation': get(qHistory, 'course._id') || '',
      Programme: get(qHistory, 'course.subProgram.program.name') || '',
      'Sous-programme': get(qHistory, 'course.subProgram.name') || '',
      'Prénom Nom intervenant·e': formatTrainersName(get(qHistory, 'course.trainers', [])),
      Structure: get(qHistory, 'company.name'),
      'Date de réponse': CompaniDate(qHistory.createdAt).format(`${DD_MM_YYYY} ${HH_MM_SS}`),
      'Origine de réponse': qHistory.origin,
      'Prénom Nom répondant(e)': UtilsHelper.formatIdentity(get(qHistory, 'user.identity') || '', 'FL'),
      'Mail répondant(e)': get(qHistory, 'user.local.email'),
      'Numéro de tél répondant(e)': get(qHistory, 'user.contact.phone') || '',
      ...questionsAnswers,
    };

    rows.push(row);
  }

  return rows.length ? [Object.keys(rows[0]), ...rows.map(d => Object.values(d))] : [[NO_DATA]];
};

const formatCommonInfos = (bill, netInclTaxes) => {
  const companyName = bill.course.type === INTRA ? `${bill.companies[0].name} - ` : '';
  const misc = bill.course.misc ? ` - ${bill.course.misc}` : '';
  const courseName = `${companyName}${bill.course.subProgram.program.name}${misc}`;

  return {
    'Id formation': bill.course._id,
    Formation: courseName,
    Structure: bill.companies.map(c => c.name).join(', '),
    Payeur: bill.payer.name,
    'Montant TTC': UtilsHelper.formatFloatForExport(netInclTaxes),
  };
};

exports.exportCourseBillAndCreditNoteHistory = async (startDate, endDate, credentials) => {
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));
  const courseBills = await CourseBill
    .find({ billedAt: { $lte: endDate, $gte: startDate } })
    .populate(
      {
        path: 'course',
        select: 'subProgram misc type',
        populate: [
          { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
          { path: 'slots', select: 'startDate' },
          { path: 'slotsToPlan', select: '_id' },
        ],
      }
    )
    .populate({ path: 'companies', select: 'name' })
    .populate({ path: 'payer.company', select: 'name' })
    .populate({ path: 'payer.fundingOrganisation', select: 'name' })
    .populate({ path: 'courseCreditNote', select: 'number', options: { isVendorUser } })
    .populate({ path: 'coursePayments', select: 'netInclTaxes nature', options: { isVendorUser } })
    .setOptions({ isVendorUser })
    .lean();

  const courseCreditNotes = await CourseCreditNote
    .find({ date: { $lte: endDate, $gte: startDate } })
    .populate({
      path: 'courseBill',
      populate: [
        { path: 'companies', select: 'name' },
        { path: 'payer.company', select: 'name' },
        { path: 'payer.fundingOrganisation', select: 'name' },
        { path: 'coursePayments', select: 'netInclTaxes nature', options: { isVendorUser } },
        {
          path: 'course',
          select: 'subProgram misc type',
          populate: { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
        },
      ],
    })
    .setOptions({ isVendorUser })
    .lean();

  const rows = [];
  for (const bill of courseBills) {
    const { netInclTaxes, paid, total } = CourseBillHelper.computeAmounts(bill);
    const sortedCourseSlots = [...bill.course.slots].sort(DatesUtilsHelper.ascendingSortBy('startDate'));
    const upComingSlots = sortedCourseSlots.filter(slot => CompaniDate().isBefore(slot.startDate)).length;
    const pastSlots = sortedCourseSlots.length - upComingSlots;
    const firstCourseSlot = sortedCourseSlots.length && sortedCourseSlots[0];
    const middleIndex = Math.floor((sortedCourseSlots.length + bill.course.slotsToPlan.length - 1) / 2);
    const middleCourseSlot = middleIndex < sortedCourseSlots.length && sortedCourseSlots[middleIndex];
    const endCourseSlot = sortedCourseSlots.length && !bill.course.slotsToPlan.length &&
      sortedCourseSlots[sortedCourseSlots.length - 1];
    const commonInfos = formatCommonInfos(bill, netInclTaxes);

    const formattedBill = {
      Nature: BILLING_DOCUMENTS[BILL],
      Identifiant: bill.number,
      Date: CompaniDate(bill.billedAt).format(DD_MM_YYYY),
      ...commonInfos,
      'Montant réglé': bill.courseCreditNote
        ? UtilsHelper.formatFloatForExport(NumbersHelper.subtract(paid, netInclTaxes))
        : UtilsHelper.formatFloatForExport(paid),
      'Document lié': get(bill, 'courseCreditNote.number') || '',
      'Montant soldé': bill.courseCreditNote ? UtilsHelper.formatFloatForExport(netInclTaxes) : '',
      Solde: UtilsHelper.formatFloatForExport(total),
      Avancement: getProgress(pastSlots, bill.course),
      'Début de la formation': firstCourseSlot ? CompaniDate(firstCourseSlot.startDate).format(DD_MM_YYYY) : '',
      'Milieu de la formation': middleCourseSlot ? CompaniDate(middleCourseSlot.startDate).format(DD_MM_YYYY) : '',
      'Fin de la formation': endCourseSlot ? CompaniDate(endCourseSlot.startDate).format(DD_MM_YYYY) : '',
    };

    rows.push(formattedBill);
  }

  for (const creditNote of courseCreditNotes) {
    const { netInclTaxes } = CourseBillHelper
      .computeAmounts({ ...creditNote.courseBill, courseCreditNote: { _id: creditNote._id } });
    const commonInfos = formatCommonInfos(creditNote.courseBill, netInclTaxes);

    const formattedCreditNote = {
      Nature: BILLING_DOCUMENTS[CREDIT_NOTE],
      Identifiant: creditNote.number,
      Date: CompaniDate(creditNote.date).format(DD_MM_YYYY),
      ...commonInfos,
      'Montant réglé': '',
      'Document lié': creditNote.courseBill.number,
      'Montant soldé': '',
      Solde: '',
      Avancement: '',
      'Début de la formation': '',
      'Milieu de la formation': '',
      'Fin de la formation': '',
    };

    rows.push(formattedCreditNote);
  }

  return rows.length ? [Object.keys(rows[0]), ...rows.map(d => Object.values(d))] : [[NO_DATA]];
};

exports.exportCoursePaymentHistory = async (startDate, endDate, credentials) => {
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));
  const paymentsOnPeriod = await CoursePayment.find({ date: { $lte: endDate, $gte: startDate } }, { courseBill: 1 })
    .setOptions({ isVendorUser })
    .lean();

  if (!paymentsOnPeriod.length) return [[NO_DATA]];

  const allPaymentsForCourseBills = await CoursePayment.find(
    { courseBill: { $in: paymentsOnPeriod.map(p => p.courseBill) } },
    { nature: 1, number: 1, date: 1, courseBill: 1, type: 1, netInclTaxes: 1 }
  )
    .populate({ path: 'courseBill', option: { isVendorUser }, select: 'number' })
    .setOptions({ isVendorUser })
    .lean();

  const groupedAllPayments = Object.values(groupBy(allPaymentsForCourseBills, 'courseBill._id'))
    .map(paymentsByBill => [...paymentsByBill].sort(DatesUtilsHelper.ascendingSortBy('date')));

  const rows = groupedAllPayments
    .flatMap(billPayments => billPayments
      .reduce((acc, payment, paymentIndex) => {
        if (CompaniDate(payment.date).isSameOrBetween(startDate, endDate, DAY)) {
          acc.push({
            Nature: PAYMENT_NATURE_LIST[payment.nature],
            Identifiant: payment.number,
            Date: CompaniDate(payment.date).format(DD_MM_YYYY),
            'Facture associée': payment.courseBill.number,
            'Numéro du paiement (parmi ceux de la même facture)': paymentIndex + 1,
            'Moyen de paiement': PAYMENT_TYPES_LIST[payment.type],
            Montant: UtilsHelper.formatFloatForExport(payment.netInclTaxes),
          });
        }
        return acc;
      }, [])
    );

  return [Object.keys(rows[0]), ...rows.map(d => Object.values(d))];
};

exports.exportSelfPositionningQuestionnaireHistory = async (startDate, endDate, credentials) => {
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  const slots = await CourseSlot
    .find({ startDate: { $lte: endDate }, endDate: { $gte: startDate } }, { course: 1 })
    .lean();

  const courses = await Course
    .find(
      { _id: { $in: [...new Set(slots.map(s => s.course))] } },
      { slots: 1, slotsToPlan: 1, type: 1, subProgram: 1, trainees: 1, trainers: 1, misc: 1 }
    )
    .populate({ path: 'slotsToPlan' })
    .populate({ path: 'slots', select: 'startDate endDate' })
    .populate({ path: 'subProgram', select: 'program name', populate: [{ path: 'program', select: 'name' }] })
    .populate({ path: 'trainers', select: 'identity' })
    .lean();

  const filteredCourses = courses.filter((course) => {
    if ((course.slotsToPlan || []).length) return false;

    const slotsCount = course.slots.length;
    const lastEndSlot = course.slots[slotsCount - 1].endDate;
    return lastEndSlot && CompaniDate(lastEndSlot).isAfter(startDate) && CompaniDate(lastEndSlot).isBefore(endDate);
  });

  const courseIds = filteredCourses.map(c => c._id);
  const questionnaireHistories = await QuestionnaireHistory
    .find({ course: { $in: courseIds } }, { questionnaire: 1, course: 1, timeline: 1, questionnaireAnswersList: 1 })
    .populate({ path: 'questionnaire', select: 'type' })
    .populate({ path: 'questionnaireAnswersList.card' })
    .setOptions({ isVendorUser })
    .lean();

  const qHistoriesGroupByCourse = groupBy(
    questionnaireHistories.filter(qH => qH.questionnaire.type === SELF_POSITIONNING),
    'course'
  );

  const rows = [];
  for (const course of filteredCourses) {
    const progressByCard = {};
    const selfPositionningHistories = qHistoriesGroupByCourse[course._id];
    if (!selfPositionningHistories) continue;

    const {
      startSelfPositionningHistories,
      endSelfPositionningHistories,
    } = selfPositionningHistories.reduce((acc, h) => {
      if (h.timeline === START_COURSE) acc.startSelfPositionningHistories.push(h);
      if (h.timeline === END_COURSE) acc.endSelfPositionningHistories.push(h);
      return acc;
    }, { startSelfPositionningHistories: [], endSelfPositionningHistories: [] });

    const startSelfPositionningAnswers = startSelfPositionningHistories
      .flatMap(h => h.questionnaireAnswersList.filter(a => a.card.template === SURVEY).map(q => q.answerList));

    let startAnswersAverage;
    if (startSelfPositionningAnswers.length) {
      startAnswersAverage = NumbersHelper.divide(
        startSelfPositionningAnswers.reduce((acc, val) => NumbersHelper.add(acc, val), 0),
        startSelfPositionningAnswers.length
      );
    }

    const endSelfPositionningAnswers = endSelfPositionningHistories
      .flatMap(h => h.questionnaireAnswersList.filter(a => a.card.template === SURVEY).map(q => q.answerList));

    let endAnswersAverage;
    if (endSelfPositionningAnswers.length) {
      endAnswersAverage = NumbersHelper.divide(
        endSelfPositionningAnswers.reduce((acc, val) => NumbersHelper.add(acc, val), 0),
        endSelfPositionningAnswers.length
      );
    }

    const formattedStartAnswers = startSelfPositionningHistories
      .flatMap(h => h.questionnaireAnswersList.map(q => pick(q, ['card', 'answerList'])));
    const startAnswersByCard = groupBy(formattedStartAnswers, 'card.question');

    const formattedEndAnswers = endSelfPositionningHistories
      .flatMap(h => h.questionnaireAnswersList.map(q => pick(q, ['card', 'answerList'])));
    const endAnswersByCard = groupBy(formattedEndAnswers, 'card.question');

    for (const cardQuestion of Object.keys(startAnswersByCard)) {
      const startHistories = startAnswersByCard[cardQuestion] || [];
      const startAnswers = startHistories.flatMap(h => h.answerList);

      let startAverage;
      if (startAnswers.length) {
        startAverage = NumbersHelper.divide(
          startAnswers.reduce((acc, val) => NumbersHelper.add(acc, val), 0),
          startAnswers.length
        );
      }

      const endHistories = endAnswersByCard[cardQuestion] || [];
      const endAnswers = endHistories.flatMap(h => h.answerList);

      let endAverage;
      if (endAnswers.length) {
        endAverage = NumbersHelper.divide(
          endAnswers.reduce((acc, val) => NumbersHelper.add(acc, val), 0),
          endAnswers.length
        );
      }

      if (startAverage && endAverage) progressByCard[cardQuestion] = NumbersHelper.subtract(endAverage, startAverage);
    }

    const { maxProgressQuestion, maxProgress, minProgressQuestion, minProgress } = Object.entries(progressByCard)
      .reduce((acc, [question, value]) => ({
        maxProgressQuestion: NumbersHelper.isGreaterThan(value, acc.maxProgress) ? question : acc.maxProgressQuestion,
        maxProgress: NumbersHelper.isGreaterThan(value, acc.maxProgress) ? value : acc.maxProgress,
        minProgressQuestion: NumbersHelper.isLessThan(value, acc.minProgress) ? question : acc.minProgressQuestion,
        minProgress: NumbersHelper.isLessThan(value, acc.minProgress) ? value : acc.minProgress,
      }), { maxProgressQuestion: '', maxProgress: -5, minProgressQuestion: '', minProgress: 5 });

    rows.push({
      'Id formation': course._id,
      Programme: course.subProgram.program.name || '',
      'Infos complémentaires': course.misc,
      'Sous-programme': course.subProgram.name || '',
      'Prénom Nom intervenant': formatTrainersName(course.trainers),
      'Nombre d\'apprenants inscrits': course.trainees.length,
      'Nombre de réponses au questionnaire de début': startSelfPositionningHistories.length,
      'Moyenne de l’auto-positionnement de début': startAnswersAverage
        ? UtilsHelper.formatFloatForExport(startAnswersAverage)
        : '',
      'Nombre de réponses au questionnaire de fin': endSelfPositionningHistories.length,
      'Moyenne de l’auto-positionnement de fin': endAnswersAverage
        ? UtilsHelper.formatFloatForExport(endAnswersAverage)
        : '',
      'Delta entre la moyenne de début et de fin': endAnswersAverage && startAnswersAverage
        ? UtilsHelper.formatFloatForExport(NumbersHelper.subtract(endAnswersAverage, startAnswersAverage))
        : '',
      'Question ayant la plus grande progression': maxProgressQuestion,
      'Progression maximale associée': maxProgressQuestion && UtilsHelper.formatFloatForExport(maxProgress),
      'Question ayant la plus faible progression': minProgressQuestion,
      'Progression minimale associée': minProgressQuestion && UtilsHelper.formatFloatForExport(minProgress),
    });
  }

  return rows.length
    ? [Object.keys(rows[0]), ...rows.map(d => Object.values(d))]
    : [['Aucune donnée sur la période sélectionnée']];
};
