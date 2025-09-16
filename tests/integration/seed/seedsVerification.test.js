const { expect } = require('expect');
const groupBy = require('lodash/groupBy');
const get = require('lodash/get');
const has = require('lodash/has');
const compact = require('lodash/compact');
const Activity = require('../../../src/models/Activity');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const Attendance = require('../../../src/models/Attendance');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const Card = require('../../../src/models/Card');
const Company = require('../../../src/models/Company');
const CompanyHolding = require('../../../src/models/CompanyHolding');
const CompanyLinkRequest = require('../../../src/models/CompanyLinkRequest');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const Contract = require('../../../src/models/Contract');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillingItem = require('../../../src/models/CourseBillingItem');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CourseCreditNote = require('../../../src/models/CourseCreditNote');
const CourseCreditNoteNumber = require('../../../src/models/CourseCreditNoteNumber');
const CourseFundingOrganisation = require('../../../src/models/CourseFundingOrganisation');
const CoursePayment = require('../../../src/models/CoursePayment');
const CoursePaymentNumber = require('../../../src/models/CoursePaymentNumber');
const CourseSlot = require('../../../src/models/CourseSlot');
const CourseSmsHistory = require('../../../src/models/CourseSmsHistory');
const CourseHistory = require('../../../src/models/CourseHistory');
const Helper = require('../../../src/models/Helper');
const IdentityVerification = require('../../../src/models/IdentityVerification');
const Program = require('../../../src/models/Program');
const Questionnaire = require('../../../src/models/Questionnaire');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const TrainerMission = require('../../../src/models/TrainerMission');
const TrainingContract = require('../../../src/models/TrainingContract');
const User = require('../../../src/models/User');
const UserCompany = require('../../../src/models/UserCompany');
const UserHolding = require('../../../src/models/UserHolding');
const VendorCompany = require('../../../src/models/VendorCompany');
const { ascendingSort } = require('../../../src/helpers/dates');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');
const { CompaniDuration } = require('../../../src/helpers/dates/companiDurations');
const { descendingSortBy, ascendingSortBy } = require('../../../src/helpers/dates/utils');
const NumbersHelper = require('../../../src/helpers/numbers');
const UtilsHelper = require('../../../src/helpers/utils');
const UserCompaniesHelper = require('../../../src/helpers/userCompanies');
const {
  INTRA,
  COACH,
  TRAINEE_ADDITION,
  TRAINEE_DELETION,
  BLENDED,
  STRICTLY_E_LEARNING,
  INTER_B2B,
  INTER_B2C,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  CLIENT,
  VENDOR,
  DRAFT,
  E_LEARNING,
  PUBLISHED,
  FILL_THE_GAPS,
  SINGLE_CHOICE_QUESTION,
  QUESTION_ANSWER,
  ORDER_THE_SEQUENCE,
  MULTIPLE_CHOICE_QUESTION,
  SURVEY,
  TEXT_MEDIA,
  TITLE_TEXT_MEDIA,
  TITLE_TEXT,
  OPEN_QUESTION,
  TRANSITION,
  FLASHCARD,
  DD_MM_YYYY,
  TRAINER,
  SLOT_CREATION,
  SLOT_DELETION,
  ESTIMATED_START_DATE_EDITION,
  COMPANY_ADDITION,
  COMPANY_DELETION,
  SLOT_EDITION,
  CLIENT_ADMIN,
  ON_SITE,
  REMOTE,
  DAY,
  HOLDING_ADMIN,
  PAYMENT,
  REFUND,
  EXPECTATIONS,
  END_OF_COURSE,
  INTRA_HOLDING,
  GROUP,
  SELF_POSITIONNING,
  START_COURSE,
  END_COURSE,
  MONTHLY,
  SINGLE,
} = require('../../../src/helpers/constants');
const attendancesSeed = require('./attendancesSeed');
const activitiesSeed = require('./activitiesSeed');
const activityHistoriesSeed = require('./activityHistoriesSeed');
const attendanceSheetsSeed = require('./attendanceSheetsSeed');
const cardsSeed = require('./cardsSeed');
const categoriesSeed = require('./categoriesSeed');
const companiesSeed = require('./companiesSeed');
const companyLinkRequestsSeed = require('./companyLinkRequestsSeed');
const completionCertificatesSeed = require('./completionCertificatesSeed');
const courseBillsSeed = require('./courseBillsSeed');
const courseBillingItemsSeed = require('./courseBillingItemsSeed');
const courseCreditNotesSeed = require('./courseCreditNotesSeed');
const courseFundingOrganisationsSeed = require('./courseFundingOrganisationsSeed');
const coursePaymentsSeed = require('./coursePaymentsSeed');
const coursesSeed = require('./coursesSeed');
const courseHistoriesSeed = require('./courseHistoriesSeed');
const courseSlotsSeed = require('./courseSlotsSeed');
const driveSeed = require('./driveSeed');
const emailSeed = require('./emailSeed');
const exportsSeed = require('./exportsSeed');
const holdingsSeed = require('./holdingsSeed');
const programsSeed = require('./programsSeed');
const questionnairesSeed = require('./questionnairesSeed');
const questionnaireHistoriesSeed = require('./questionnaireHistoriesSeed');
const rolesSeed = require('./rolesSeed');
const stepsSeed = require('./stepsSeed');
const subProgramsSeed = require('./subProgramsSeed');
const trainerMissionsSeed = require('./trainerMissionsSeed');
const trainingContractsSeed = require('./trainingContractsSeed');
const userCompaniesSeed = require('./userCompaniesSeed');
const usersSeed = require('./usersSeed');
const vendorCompaniesSeed = require('./vendorCompaniesSeed');

const seedList = [
  { label: 'ACTIVITY', value: activitiesSeed },
  { label: 'ACTIVITYHISTORY', value: activityHistoriesSeed },
  { label: 'ATTENDANCE', value: attendancesSeed },
  { label: 'ATTENDANCESHEET', value: attendanceSheetsSeed },
  { label: 'CARD', value: cardsSeed },
  { label: 'CATEGORY', value: categoriesSeed },
  { label: 'COMPANY', value: companiesSeed },
  { label: 'COMPANYLINKREQUEST', value: companyLinkRequestsSeed },
  { label: 'COMPLETIONCERTIFICATES', value: completionCertificatesSeed },
  { label: 'COURSE', value: coursesSeed },
  { label: 'COURSEBILL', value: courseBillsSeed },
  { label: 'COURSEBILLINGITEM', value: courseBillingItemsSeed },
  { label: 'COURSECREDITNOTE', value: courseCreditNotesSeed },
  { label: 'COURSEFUNDINGORGANISATION', value: courseFundingOrganisationsSeed },
  { label: 'COURSEPAYMENT', value: coursePaymentsSeed },
  { label: 'COURSEHISTORY', value: courseHistoriesSeed },
  { label: 'COURSESLOT', value: courseSlotsSeed },
  { label: 'DRIVE', value: driveSeed },
  { label: 'EMAIL', value: emailSeed },
  { label: 'EXPORT', value: exportsSeed },
  { label: 'HOLDING', value: holdingsSeed },
  { label: 'PROGRAM', value: programsSeed },
  { label: 'QUESTIONNAIRE', value: questionnairesSeed },
  { label: 'QUESTIONNAIREHISTORY', value: questionnaireHistoriesSeed },
  { label: 'ROLE', value: rolesSeed },
  { label: 'STEP', value: stepsSeed },
  { label: 'SUBPROGRAM', value: subProgramsSeed },
  { label: 'TRAINERMISSION', value: trainerMissionsSeed },
  { label: 'TRAININGCONTRACT', value: trainingContractsSeed },
  { label: 'USERCOMPANY', value: userCompaniesSeed },
  { label: 'USER', value: usersSeed },
  { label: 'VENDORCOMPANY', value: vendorCompaniesSeed },
];

const transform = doc => (doc || null);

describe('SEEDS VERIFICATION', () => {
  seedList.forEach(({ label, value: seeds }) => {
    describe(`${label} SEEDS FILE`, () => {
      before(seeds.populateDB);

      describe('Collection Activity', () => {
        let activityList;
        before(async () => {
          activityList = await Activity
            .find()
            .populate({ path: 'cards', select: '-__v -createdAt -updatedAt', transform })
            .lean({ virtuals: true });
        });

        it('should pass if every card exists and is not duplicated', () => {
          const everyCardsExists = activityList.every(activity => activity.cards.every(card => card));

          expect(everyCardsExists).toBeTruthy();

          const someCardsAreDuplicated = activityList
            .some((activity) => {
              const cardsWithoutDuplicates = [...new Set(activity.cards.map(card => card._id.toHexString()))];

              return activity.cards.length !== cardsWithoutDuplicates.length;
            });

          expect(someCardsAreDuplicated).toBeFalsy();
        });

        it('should pass if published activities have at least one card', () => {
          const everyPublishedActivityHasCards = activityList
            .every(activity => activity.status === DRAFT || activity.cards.length);

          expect(everyPublishedActivityHasCards).toBeTruthy();
        });

        it('should pass if published activities have all their cards valid', () => {
          const everyPublishedActivityHasValidCards = activityList
            .every(activity => activity.status === DRAFT || activity.areCardsValid);

          expect(everyPublishedActivityHasValidCards).toBeTruthy();
        });
      });

      describe('Collection Activity History', () => {
        let activityHistoryList;
        before(async () => {
          activityHistoryList = await ActivityHistory
            .find()
            .populate({ path: 'user', select: '_id', transform })
            .populate({ path: 'activity', select: '_id cards', populate: { path: 'cards' }, transform })
            .populate({ path: 'questionnaireAnswersList.card', select: 'template', transform })
            .lean({ virtuals: true });
        });

        it('should pass if every user exists', () => {
          const everyUsersExists = activityHistoryList.every(ah => ah.user);

          expect(everyUsersExists).toBeTruthy();
        });

        it('should pass if user is registered to a course with the activity', async () => {
          const stepList = await Step
            .find({ activities: { $in: activityHistoryList.map(ah => ah.activity._id) } })
            .lean();
          const subProgramList = await SubProgram.find({ steps: { $in: stepList.map(s => s._id) } }).lean();
          const courseList = await Course.find({ subProgram: { $in: subProgramList.map(sp => sp._id) } }).lean();

          const groupedStepsByActivity = groupBy(
            stepList.flatMap(s => s.activities.map(a => ({ ...s, activities: a }))),
            'activities'
          );
          const groupedSubProgramsByStep = groupBy(
            subProgramList.flatMap(sp => sp.steps.map(s => ({ ...sp, steps: s }))),
            'steps'
          );
          const groupedCoursesBySubProgram = groupBy(courseList, 'subProgram');
          const everyUserIsRegisteredToCourse = activityHistoryList
            .every(ah => groupedStepsByActivity[ah.activity._id]
              .some(step => groupedSubProgramsByStep[step._id]
                .some(subProgram => !!groupedCoursesBySubProgram[subProgram._id] &&
                    groupedCoursesBySubProgram[subProgram._id]
                      .some(course => UtilsHelper.doesArrayIncludeId(course.trainees, ah.user._id))
                )
              )
            );
          expect(everyUserIsRegisteredToCourse).toBeTruthy();
        });

        it('should pass if every activity exists', () => {
          const everyActivityExists = activityHistoryList.every(ah => ah.activity);

          expect(everyActivityExists).toBeTruthy();
        });

        it('should pass if every card exists and is in activity', () => {
          const everyCardExists = activityHistoryList.every(ah => ah.questionnaireAnswersList.every(qal => qal.card));

          expect(everyCardExists).toBeTruthy();

          const someCardsAreNotInActivities = activityHistoryList
            .some((ah) => {
              const cardIds = ah.activity.cards.map(c => c._id);

              return ah.questionnaireAnswersList.some(qal => !UtilsHelper.doesArrayIncludeId(cardIds, qal.card._id));
            });

          expect(someCardsAreNotInActivities).toBeFalsy();
        });

        it('should pass if every questionnaire answers list card is a questionnaire card', () => {
          const everyCardHasGoodTemplate = activityHistoryList
            .every(ah => ah.questionnaireAnswersList
              .every(qal => [SURVEY, OPEN_QUESTION, QUESTION_ANSWER].includes(qal.card.template)));

          expect(everyCardHasGoodTemplate).toBeTruthy();
        });

        it('should pass if every mandatory card has answer', () => {
          const everyMandatoryCardHasAnswer = activityHistoryList
            .every(ah => ah.activity.cards.every(c => !c.isMandatory ||
              ah.questionnaireAnswersList.some(qal => UtilsHelper.areObjectIdsEquals(c._id, qal.card._id)))
            );

          expect(everyMandatoryCardHasAnswer).toBeTruthy();
        });

        it('should pass if there is the good answers number', () => {
          const everyHistoryHasGoodAnswersNumber = activityHistoryList
            .every(ah => !ah.questionnaireAnswersList.length ||
              ah.questionnaireAnswersList
                .every(qal => qal.answerList.length === 1 || qal.card.template === QUESTION_ANSWER));

          expect(everyHistoryHasGoodAnswersNumber).toBeTruthy();
        });

        it('should pass if score is lower or equal to quizz cards count in activity', () => {
          const isScoreLowerOrEqualToQuizzCardsCount = activityHistoryList
            .every((ah) => {
              const quizzCardsTemplates = [
                FILL_THE_GAPS,
                MULTIPLE_CHOICE_QUESTION,
                SINGLE_CHOICE_QUESTION,
                ORDER_THE_SEQUENCE,
              ];
              const quizzCardsCount = ah.activity.cards.filter(c => quizzCardsTemplates.includes(c.template)).length;

              return (!quizzCardsCount && !has(ah, 'score')) || (ah.score <= quizzCardsCount);
            });

          expect(isScoreLowerOrEqualToQuizzCardsCount).toBeTruthy();
        });
      });

      describe('Collection Attendance', () => {
        let attendanceList;
        before(async () => {
          attendanceList = await Attendance
            .find()
            .populate({ path: 'trainee', select: 'id', populate: { path: 'userCompanyList' } })
            .populate({
              path: 'courseSlot',
              select: '_id course',
              populate: { path: 'course', select: 'companies type' },
            })
            .populate({ path: 'company', select: '_id' })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if every trainee exists', () => {
          const everyTraineeExists = attendanceList.every(a => a.trainee);

          expect(everyTraineeExists).toBeTruthy();
        });

        it('should pass if all attendance\'s trainee are in attendance\'s company', () => {
          const areTraineesInCompany = attendanceList
            .every(attendance => attendance.trainee.userCompanyList
              .some(uc => UtilsHelper.areObjectIdsEquals(uc.company, attendance.company._id))
            );
          expect(areTraineesInCompany).toBeTruthy();
        });

        it('should pass if every slot exists', () => {
          const everySlotExists = attendanceList.every(a => a.courseSlot);

          expect(everySlotExists).toBeTruthy();
        });

        it('should pass if every company exists', () => {
          const everyCompanyExists = attendanceList.every(a => a.company);

          expect(everyCompanyExists).toBeTruthy();
        });

        it('should pass if every company is attached to course on intra/inter b2b/single', () => {
          const everyCompanyIsInCourse = attendanceList
            .every(a => a.courseSlot.course.type === INTRA_HOLDING ||
              UtilsHelper.doesArrayIncludeId(a.courseSlot.course.companies, a.company._id));

          expect(everyCompanyIsInCourse).toBeTruthy();
        });
      });

      describe('Collection AttendanceSheet', () => {
        let attendanceSheetList;
        before(async () => {
          attendanceSheetList = await AttendanceSheet
            .find()
            .populate({ path: 'trainee', select: 'id', populate: { path: 'userCompanyList' } })
            .populate({
              path: 'course',
              select: '_id type companies subProgram trainers',
              populate: { path: 'slots', select: 'startDate' },
            })
            .populate({ path: 'companies', select: '_id' })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if every course exists', () => {
          const everyCourseExists = attendanceSheetList.every(a => a.course);

          expect(everyCourseExists).toBeTruthy();
        });

        it('should pass if only intra and intra holding courses have date in attendance sheet', () => {
          const everyIntraOrIntraHoldingAttendanceSheetHasDate = attendanceSheetList
            .every(a => [SINGLE, INTER_B2B].includes(a.course.type) || a.date);

          expect(everyIntraOrIntraHoldingAttendanceSheetHasDate).toBeTruthy();

          const someInterOrSingleAttendanceSheetHasDate = attendanceSheetList
            .some(a => [INTER_B2B, SINGLE].includes(a.course.type) && a.date);

          expect(someInterOrSingleAttendanceSheetHasDate).toBeFalsy();
        });

        it('should pass if only inter or single courses have trainee in attendance sheet', () => {
          const everyTraineeExists = attendanceSheetList
            .every(a => [INTRA, INTRA_HOLDING].includes(a.course.type) || a.trainee);

          expect(everyTraineeExists).toBeTruthy();

          const someIntraOrIntraHoldingAttendanceSheetHasTrainee = attendanceSheetList
            .some(a => [INTRA, INTRA_HOLDING].includes(a.course.type) && a.trainee);

          expect(someIntraOrIntraHoldingAttendanceSheetHasTrainee).toBeFalsy();
        });

        it('should pass if only single courses have slots in attendance sheet', () => {
          const everySingleASHasSlots = attendanceSheetList.every(a => a.course.type !== SINGLE || a.slots);

          expect(everySingleASHasSlots).toBeTruthy();

          const someNonSingleASHasSlots = attendanceSheetList.some(a => a.course.type !== SINGLE && a.slots);

          expect(someNonSingleASHasSlots).toBeFalsy();
        });

        it('should pass if only intra_holding courses have several companies in attendance sheet', () => {
          const doSheetsHaveGoodCompaniesNumber = attendanceSheetList
            .every(a => a.companies.length === 1 || a.course.type === INTRA_HOLDING);

          expect(doSheetsHaveGoodCompaniesNumber).toBeTruthy();
        });

        it('should pass if attendance sheet dates are course slots dates', () => {
          const everySheetDateIsSlotDate = attendanceSheetList
            .filter(a => [INTRA, INTRA_HOLDING].includes(a.course.type))
            .every((a) => {
              const slotsDates = a.course.slots.map(slot => CompaniDate(slot.startDate).format(DD_MM_YYYY));

              return slotsDates.includes(CompaniDate(a.date).format(DD_MM_YYYY));
            });

          expect(everySheetDateIsSlotDate).toBeTruthy();
        });

        it('should pass if attendance sheet slots are course slots', () => {
          const everySheetDateIsSlotDate = attendanceSheetList
            .filter(a => a.course.type === SINGLE)
            .every((a) => {
              const slotsIds = a.course.slots.map(slot => slot._id);

              return a.slots.every(slot => UtilsHelper.doesArrayIncludeId(slotsIds, slot));
            });

          expect(everySheetDateIsSlotDate).toBeTruthy();
        });

        it('should pass if all attendance sheet\'s trainee are in attendance sheet\'s company', () => {
          const areTraineesInCompany = attendanceSheetList
            .filter(attendanceSheet => attendanceSheet.trainee)
            .every(attendanceSheet => attendanceSheet.trainee.userCompanyList
              .some(uc => UtilsHelper.areObjectIdsEquals(uc.company, attendanceSheet.companies[0]._id))
            );
          expect(areTraineesInCompany).toBeTruthy();
        });

        it('should pass if every company exists', () => {
          const everyCompanyExists = attendanceSheetList.every(a => a.companies.every(c => c));

          expect(everyCompanyExists).toBeTruthy();
        });

        it('should pass if every company is rattached to course', () => {
          const everyCompanyIsInCourse = attendanceSheetList
            .every(a => a.companies.every(c => UtilsHelper.doesArrayIncludeId(a.course.companies, c._id)));

          expect(everyCompanyIsInCourse).toBeTruthy();
        });

        it('should pass if all attendance sheet\'s trainers are course trainers', () => {
          const areTrainerInCourse = attendanceSheetList
            .every(attendanceSheet => !!attendanceSheet.trainer &&
              UtilsHelper.doesArrayIncludeId(attendanceSheet.course.trainers, attendanceSheet.trainer));
          expect(areTrainerInCourse).toBeTruthy();
        });
      });

      describe('Collection Card', () => {
        let cardList;
        before(async () => {
          cardList = await Card.find({}, { __v: 0, createdAt: 0, updatedAt: 0 }).lean();
        });

        const templateList = [
          {
            name: FILL_THE_GAPS,
            allowedKeys: ['gappedText', 'explanation', 'gapAnswers', 'canSwitchAnswers'],
          },
          {
            name: SINGLE_CHOICE_QUESTION,
            allowedKeys: ['question', 'qcAnswers', 'explanation'],
          },
          {
            name: QUESTION_ANSWER,
            allowedKeys: ['question', 'isQuestionAnswerMultipleChoiced', 'qcAnswers', 'isMandatory'],
          },
          {
            name: ORDER_THE_SEQUENCE,
            allowedKeys: ['question', 'orderedAnswers', 'explanation', 'isChronological'],
          },
          {
            name: MULTIPLE_CHOICE_QUESTION,
            allowedKeys: ['question', 'qcAnswers', 'explanation'],
          },
          {
            name: SURVEY,
            allowedKeys: ['question', 'labels.1', 'labels.2', 'labels.3', 'labels.4', 'labels.5', 'isMandatory'],
          },
          {
            name: TEXT_MEDIA,
            allowedKeys: ['text', 'media.link', 'media.publicId', 'media.type'],
          },
          {
            name: TITLE_TEXT_MEDIA,
            allowedKeys: ['text', 'title', 'media.link', 'media.publicId', 'media.type'],
          },
          {
            name: TITLE_TEXT,
            allowedKeys: ['text', 'title'],
          },
          {
            name: OPEN_QUESTION,
            allowedKeys: ['question', 'isMandatory'],
          },
          {
            name: TRANSITION,
            allowedKeys: ['title'],
          },
          {
            name: FLASHCARD,
            allowedKeys: ['text', 'backText'],
          },
        ];

        templateList.forEach((template) => {
          it(`should pass if every field in '${template.name}' card is allowed`, () => {
            const someKeysAreNotAllowed = cardList
              .filter(card => card.template === template.name)
              .some(card => UtilsHelper.getKeysOf2DepthObject(card)
                .filter(key => !['_id', 'template'].includes(key))
                .some(key => !template.allowedKeys.includes(key)));

            expect(someKeysAreNotAllowed).toBeFalsy();
          });
        });

        const keysWithTextSubKey = ['gapAnswers', 'qcAnswers', 'orderedAnswers'];

        keysWithTextSubKey.forEach((key) => {
          it(`should pass if in '${key}' objects we have 'text'`, () => {
            const someSubKeysAreMissing = cardList
              .some(card => has(card, key) && card[key].some(object => !has(object, 'text')));

            expect(someSubKeysAreMissing).toBeFalsy();
          });
        });

        it('should pass if only \'choice question\' or \'fill the gap \' cards has isCorrect key in \'qcAnswers\''
          + 'field',
        () => {
          const someSubKeysAreWrong = cardList
            .some(card =>
              ![MULTIPLE_CHOICE_QUESTION, SINGLE_CHOICE_QUESTION, FILL_THE_GAPS].includes(card.template) &&
                has(card, 'qcAnswers') && card.qcAnswers.some(object => has(object, 'isCorrect')));

          expect(someSubKeysAreWrong).toBeFalsy();
        });

        it('should pass if every \'order the sequence\' cards has 3 answers',
          () => {
            const orderedAnswersCountIsGood = cardList
              .every(card => card.template !== ORDER_THE_SEQUENCE || card.orderedAnswers.length === 3);

            expect(orderedAnswersCountIsGood).toBeTruthy();
          });

        it('should pass if every card with \'labels\' field contains right keys', () => {
          const someSubKeysAreMissing = cardList
            .some((card) => {
              const hasWrongKeys = has(card, 'labels') &&
                !(
                  (Object.keys(card.labels).length === 2 && ['1', '5'].every(item => has(card, `labels.${item}`))) ||
                  ['1', '2', '3', '4', '5'].every(item => has(card, `labels.${item}`))
                );

              return hasWrongKeys;
            });

          expect(someSubKeysAreMissing).toBeFalsy();
        });
      });

      describe('Collection Company', () => {
        let companyList;
        before((async () => {
          companyList = await Company
            .find()
            .populate({
              path: 'billingRepresentative',
              populate: [{ path: 'role.client', select: 'name' }, { path: 'role.holding', select: 'name' }],
            })
            .lean();
        }));

        it('should pass if every name is unique', () => {
          const companiesWithoutDuplicates = [...new Set(companyList.map(company => company.name))];
          expect(companiesWithoutDuplicates.length).toEqual(companyList.length);
        });

        it('should pass if every billingRepresentative exists and has good role', () => {
          const doesEveryUserExistAndHasGoodRole = companyList
            .every(company => !has(company, 'billingRepresentative') ||
              (get(company.billingRepresentative, 'role.client.name') === CLIENT_ADMIN ||
                get(company.billingRepresentative, 'role.holding.name') === HOLDING_ADMIN)
            );
          expect(doesEveryUserExistAndHasGoodRole).toBeTruthy();
        });

        it('should pass if every company has debitMandates', () => {
          const companiesWithDebitMandates = companyList.filter(company => company.debitMandates.length);
          expect(companiesWithDebitMandates.length).toEqual(companyList.length);
        });

        it('should pass if every rum is unique', () => {
          const companiesWithoutDuplicatesRum = [...new Set(
            companyList.map(company => company.debitMandates.flatMap(dm => dm.rum))
          )];
          expect(companiesWithoutDuplicatesRum.length).toEqual(companyList.length);
        });
      });

      describe('Collection CompanyHolding', () => {
        let companyHoldingList;
        before(async () => {
          companyHoldingList = await CompanyHolding
            .find()
            .populate({ path: 'holding', select: '_id' })
            .populate({ path: 'company', select: '_id' })
            .lean();
        });

        it('should pass if every company exists', () => {
          const companiesExist = companyHoldingList.map(ch => ch.company).every(company => !!company);
          expect(companiesExist).toBeTruthy();
        });

        it('should pass if every holding exists', () => {
          const holdingsExist = companyHoldingList.map(ch => ch.holding).every(holding => !!holding);
          expect(holdingsExist).toBeTruthy();
        });

        it('should pass if every company is linked to a single holding', () => {
          const companyIsLinkedToManyHoldings = companyHoldingList
            .some(companyHolding => companyHoldingList
              .filter(ch => UtilsHelper.areObjectIdsEquals(companyHolding.company._id, ch.company._id)).length > 1
            );
          expect(companyIsLinkedToManyHoldings).toBeFalsy();
        });
      });

      describe('Collection CompanyLinkRequest', () => {
        let companyLinkRequestList;
        before(async () => {
          companyLinkRequestList = await CompanyLinkRequest
            .find()
            .populate({ path: 'user', select: '_id', populate: { path: 'userCompanyList' } })
            .populate({ path: 'company', select: '_id', transform })
            .lean();
        });

        it('should pass if every user exists', () => {
          const usersExist = companyLinkRequestList.map(request => request.user).every(user => !!user);
          expect(usersExist).toBeTruthy();
        });

        it('should pass if every company exists', () => {
          const companiesExist = companyLinkRequestList.map(request => request.company).every(company => !!company);
          expect(companiesExist).toBeTruthy();
        });

        it('should pass if no user has or will have a company', () => {
          const doUsersAlreadyHaveCompany = companyLinkRequestList
            .some(request =>
              UserCompaniesHelper.getCurrentAndFutureCompanies(get(request.user, 'userCompanyList')).length
            );
          expect(doUsersAlreadyHaveCompany).toBeFalsy();
        });
      });

      describe('Collection CompletionCertificate', () => {
        let completionCertificates;
        before(async () => {
          completionCertificates = await CompletionCertificate
            .find()
            .populate({ path: 'course', select: 'trainees certificateGenerationMode' })
            .setOptions({ isVendorUser: true })
            .lean();
        });

        it('should pass if trainee is registered to course', () => {
          const traineeIsRegisteredToCourse = completionCertificates
            .every(cc => UtilsHelper.doesArrayIncludeId(cc.course.trainees, cc.trainee));

          expect(traineeIsRegisteredToCourse).toBeTruthy();
        });

        it('should pass if course has monthly certificate generation', () => {
          const courseCertificateGenerationIsMonthly = completionCertificates
            .every(cc => cc.course.certificateGenerationMode === MONTHLY);

          expect(courseCertificateGenerationIsMonthly).toBeTruthy();
        });
      });

      describe('Collection Contract', () => {
        let contractList;
        before(async () => {
          contractList = await Contract
            .find()
            .populate({ path: 'user', select: '_id', populate: { path: 'userCompanyList' } })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if all users are in company at contrat startDate', () => {
          const areUsersInCompanyAtContractStartDate = contractList
            .every(contract => contract.user.userCompanyList
              .some(uc => UtilsHelper.areObjectIdsEquals(uc.company, contract.company) &&
                CompaniDate(contract.startDate).isSameOrAfter(uc.startDate)
              )
            );
          expect(areUsersInCompanyAtContractStartDate).toBeTruthy();
        });
      });

      describe('Collection Course', () => {
        let courseList;
        before(async () => {
          courseList = await Course
            .find()
            .populate({
              path: 'trainees',
              select: '_id',
              populate: { path: 'userCompanyList' },
              transform,
            })
            .populate({
              path: 'companyRepresentative',
              select: '_id',
              populate: [
                { path: 'company' },
                { path: 'holding' },
                { path: 'role.client', select: 'name' },
                { path: 'role.holding', select: 'name' },
              ],
            })
            .populate({
              path: 'operationsRepresentative',
              select: '_id',
              populate: [{ path: 'role.vendor', select: 'name' }],
            })
            .populate({ path: 'trainers', select: '_id role.vendor' })
            .populate({ path: 'companies', select: '_id', transform })
            .populate({ path: 'holding', select: '_id', populate: { path: 'companies' } })
            .populate({ path: 'accessRules', select: '_id', transform })
            .populate({ path: 'subProgram', select: '_id status steps', populate: { path: 'steps', select: 'type' } })
            .populate({ path: 'slots', select: 'endDate' })
            .populate({ path: 'slotsToPlan' })
            .lean({ virtuals: true });
        });

        it('should pass if all trainees are in course companies', () => {
          const isEveryTraineeCompanyAttachedToCourse = courseList
            .filter(course => course.format === BLENDED)
            .every(course => course.trainees
              .every(trainee => get(trainee, 'userCompanyList', [])
                .some(uc => UtilsHelper.doesArrayIncludeId(course.companies.map(c => get(c, '_id')), uc.company))
              ));
          expect(isEveryTraineeCompanyAttachedToCourse).toBeTruthy();
        });

        it('should pass if all certified trainees are in course trainees', () => {
          const isEveryCertifiedTraineeAttachedToCourse = courseList
            .filter(course => course.format === BLENDED)
            .every(course => !course.certifiedTrainees || course.certifiedTrainees
              .every(trainee => UtilsHelper.doesArrayIncludeId(course.trainees.map(t => t._id), trainee)));
          expect(isEveryCertifiedTraineeAttachedToCourse).toBeTruthy();
        });

        it('should pass if companyRepresentative is defined in intra or intra_holding or single course only', () => {
          const isCompanyRepresentativeOnlyInIntraOrSingleCourses = courseList
            .every(c => !c.companyRepresentative || [INTRA, INTRA_HOLDING, SINGLE].includes(c.type));
          expect(isCompanyRepresentativeOnlyInIntraOrSingleCourses).toBeTruthy();
        });

        it('should pass if companyRepresentative has good role', () => {
          const areCompanyRepresentativesCoachOrAdmin = courseList.every(c => !c.companyRepresentative ||
            [COACH, CLIENT_ADMIN].includes(get(c.companyRepresentative, 'role.client.name')));
          expect(areCompanyRepresentativesCoachOrAdmin).toBeTruthy();
        });

        it('should pass if companyRepresentative is holding admin in intra holding courses', () => {
          const areCompanyRepresentativesHoldingAdmin = courseList
            .filter(c => c.type === INTRA_HOLDING)
            .every(c => !c.companyRepresentative ||
              [HOLDING_ADMIN].includes(get(c.companyRepresentative, 'role.holding.name')));
          expect(areCompanyRepresentativesHoldingAdmin).toBeTruthy();
        });

        it('should pass if companyRepresentative is in good company (intra and single courses)', () => {
          const areCoursesAndCompanyRepresentativesInSameCompany = courseList
            .filter(c => [SINGLE, INTRA].includes(c.type))
            .every(c => !c.companyRepresentative ||
              UtilsHelper.areObjectIdsEquals(c.companyRepresentative.company, c.companies[0]._id));
          expect(areCoursesAndCompanyRepresentativesInSameCompany).toBeTruthy();
        });

        it('should pass if companyRepresentative is in good holding (intra_holding courses)', () => {
          const companyRepIsInCourseHolding = courseList
            .filter(c => c.type === INTRA_HOLDING)
            .every(c => !c.companyRepresentative ||
              UtilsHelper.areObjectIdsEquals(c.companyRepresentative.holding, c.holding._id));
          expect(companyRepIsInCourseHolding).toBeTruthy();
        });

        it('should pass if all trainees registered in restricted access courses are in good company', () => {
          const isEveryTraineeCompanyInAccessRules = courseList
            .filter(course => course.format === STRICTLY_E_LEARNING && get(course, 'accessRules.length'))
            .every(course => course.trainees
              .every(trainee => get(trainee, 'userCompanyList', [])
                .some(uc => UtilsHelper.doesArrayIncludeId(course.accessRules.map(c => get(c, '_id')), uc.company))
              ));
          expect(isEveryTraineeCompanyInAccessRules).toBeTruthy();
        });

        it('should pass if every access rules company exists and is not duplicated', () => {
          const coursesWithAccessRules = courseList.filter(c => c.accessRules.length);
          const everyCompanyExists = coursesWithAccessRules.every(c => c.accessRules.every(company => company));

          expect(everyCompanyExists).toBeTruthy();

          const someAccessRulesAreDuplicated = coursesWithAccessRules
            .some((course) => {
              const accessRulesWithoutDuplicates = [...new Set(course.accessRules.map(c => c._id.toHexString()))];

              return course.accessRules.length !== accessRulesWithoutDuplicates.length;
            });

          expect(someAccessRulesAreDuplicated).toBeFalsy();
        });

        it('should pass if every subprogram exists and is published', () => {
          const subProgramsExistAndIsPublished = courseList
            .map(course => course.subProgram)
            .every(subProgram => subProgram.status === PUBLISHED);
          expect(subProgramsExistAndIsPublished).toBeTruthy();
        });

        it('should pass if every company exists and is not duplicated', () => {
          const everyCompanyExists = courseList
            .filter(c => c.format === BLENDED)
            .every(c => c.companies.every(company => company));

          expect(everyCompanyExists).toBeTruthy();

          const someCompaniesAreDuplicated = courseList
            .filter(course => get(course, 'companies.length'))
            .some((course) => {
              const companiesWithoutDuplicates = [...new Set(course.companies.map(c => c._id.toHexString()))];

              return course.companies.length !== companiesWithoutDuplicates.length;
            });

          expect(someCompaniesAreDuplicated).toBeFalsy();
        });

        it('should pass if intra or single courses have one and only one company', () => {
          const everyIntraOrSingleCourseHasCompany = courseList
            .filter(course => [INTRA, SINGLE].includes(course.type))
            .every(course => course.companies.length === 1);

          expect(everyIntraOrSingleCourseHasCompany).toBeTruthy();
        });

        it('should pass if only intra_holding courses have a holding', () => {
          const onlyIntraHoldingCoursesHaveHolding = courseList
            .every(course => course.type === INTRA_HOLDING || !has(course, 'holding'));

          expect(onlyIntraHoldingCoursesHaveHolding).toBeTruthy();
        });

        it('should pass if every holding exists', () => {
          const holdingExist = courseList
            .every(course => course.type !== INTRA_HOLDING || course.holding);

          expect(holdingExist).toBeTruthy();
        });

        it('should pass if companies are in intra_holding courses holding', () => {
          const companiesAreInHolding = courseList
            .filter(course => has(course, 'holding'))
            .every(course => course.companies
              .every(company => UtilsHelper.doesArrayIncludeId(course.holding.companies, company._id)));

          expect(companiesAreInHolding).toBeTruthy();
        });

        it('should pass if no e-learning course has companies field', () => {
          const noElearningCourseHasCompanies = courseList
            .filter(course => course.format === STRICTLY_E_LEARNING)
            .every(course => !has(course, 'companies'));
          expect(noElearningCourseHasCompanies).toBeTruthy();
        });

        it('should pass if no e-learning course has misc field', () => {
          const noELearningCourseHasMisc = courseList
            .filter(course => course.format === STRICTLY_E_LEARNING)
            .every(course => !has(course, 'misc'));
          expect(noELearningCourseHasMisc).toBeTruthy();
        });

        it('should pass if no e-learning course has certification', () => {
          const noELearningCourseHasCertification = courseList
            .filter(course => course.format === STRICTLY_E_LEARNING)
            .every(course => !(has(course, 'hasCertifyingTest') || has(course, 'certifiedTrainees')));
          expect(noELearningCourseHasCertification).toBeTruthy();
        });

        it('should pass if every blended course is intra or inter_b2b or intra_holding or single', () => {
          const everyBlendedCourseHasGoodType = courseList
            .filter(course => course.format === BLENDED)
            .every(course => [INTRA, INTER_B2B, INTRA_HOLDING, SINGLE].includes(course.type));

          expect(everyBlendedCourseHasGoodType).toBeTruthy();
        });

        it('should pass if only strictly elearning course has strictly e_learning subProgram', () => {
          const doCoursesHaveGoodSubProgramFormat = courseList
            .every(course => (course.subProgram.isStrictlyELearning && course.format === STRICTLY_E_LEARNING) ||
              course.format === BLENDED);

          expect(doCoursesHaveGoodSubProgramFormat).toBeTruthy();
        });

        it('should pass if every strictly e-learning course is inter_b2c', () => {
          const everyELearningCourseHasGoodType = courseList
            .filter(course => course.format === STRICTLY_E_LEARNING)
            .every(course => course.type === INTER_B2C);

          expect(everyELearningCourseHasGoodType).toBeTruthy();
        });

        it('should pass if only certifying course has certified trainees list', () => {
          const doOnlyCertifiyingCoursesHaveCertifiedTrainees = courseList
            .filter(course => course.format === BLENDED)
            .every(course => !has(course, 'certifiedTrainees') || course.hasCertifyingTest);

          expect(doOnlyCertifiyingCoursesHaveCertifiedTrainees).toBeTruthy();
        });

        it('should pass if trainer is never in trainees list', () => {
          const isTrainerIncludedInTrainees = courseList
            .some(c => has(c, 'trainers') &&
              c.trainers
                .some(trainer => UtilsHelper.doesArrayIncludeId(c.trainees.map(t => get(t, '_id')), trainer._id))
            );
          expect(isTrainerIncludedInTrainees).toBeFalsy();
        });

        it('should pass if every trainee exists and is not duplicated', () => {
          const everyTraineeExists = courseList.every(c => c.trainees.every(trainee => trainee));

          expect(everyTraineeExists).toBeTruthy();

          const someTraineesAreDuplicated = courseList
            .some((course) => {
              const traineesWithoutDuplicates = [...new Set(course.trainees.map(t => t._id.toHexString()))];

              return course.trainees.length !== traineesWithoutDuplicates.length;
            });

          expect(someTraineesAreDuplicated).toBeFalsy();
        });

        it('should pass if every trainer has good role', () => {
          const haveTrainersVendorRole = courseList
            .every(c => !has(c, 'trainers') || c.trainers.every(t => has(t, 'role.vendor')));
          expect(haveTrainersVendorRole).toBeTruthy();
        });

        it('should pass if contact is trainer, company representative or operations representative', () => {
          const isContactGoodUser = courseList
            .filter(c => has(c, 'contact'))
            .every((c) => {
              const acceptedUsers = compact([
                get(c, 'operationsRepresentative._id'),
                ...get(c, 'trainers').map(t => t._id),
                get(c, 'companyRepresentative._id'),
              ]);

              return UtilsHelper.doesArrayIncludeId(acceptedUsers, c.contact);
            });
          expect(isContactGoodUser).toBeTruthy();
        });

        it('should pass if no access rules for blended courses', () => {
          const noBlendedCourseHasAccessRules = courseList.every(c => c.format !== BLENDED || !c.accessRules.length);
          expect(noBlendedCourseHasAccessRules).toBeTruthy();
        });

        it('should pass if only blended courses have interlocutors', () => {
          const doELearningCoursesHaveInterlocutors = courseList
            .some(c => c.format === STRICTLY_E_LEARNING &&
              (c.operationsRepresentative || c.trainers.length || c.companyRepresentative));
          expect(doELearningCoursesHaveInterlocutors).toBeFalsy();
        });

        it('should pass if all operations representative are rof or vendor admin', () => {
          const doAllOperationsRepresentativeHaveGoodRole = courseList
            .filter(c => c.operationsRepresentative)
            .every(c => [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
              .includes(get(c.operationsRepresentative, 'role.vendor.name')));
          expect(doAllOperationsRepresentativeHaveGoodRole).toBeTruthy();
        });

        it('should pass if estimated start date is defined for blended courses only', () => {
          const doELearningCoursesHaveEstimatedStartDate = courseList
            .some(c => c.format === STRICTLY_E_LEARNING && c.estimatedStartDate);
          expect(doELearningCoursesHaveEstimatedStartDate).toBeFalsy();
        });

        it('should pass if archive date is defined for blended courses only', () => {
          const doELearningCoursesHaveArchiveDate = courseList
            .some(c => c.format === STRICTLY_E_LEARNING && c.archivedAt);
          expect(doELearningCoursesHaveArchiveDate).toBeFalsy();
        });

        it('should pass if archive date is always after last slot', () => {
          const isArchiveDateAfterLastSlot = courseList
            .every((c) => {
              if (!c.archivedAt || !c.slots.length) return true;
              const lastSlot = c.slots[c.slots.length - 1];

              return CompaniDate(c.archivedAt).isAfter(lastSlot.endDate);
            });
          expect(isArchiveDateAfterLastSlot).toBeTruthy();
        });

        it('should pass if max trainees is defined only for intra or intra_holding or single courses', () => {
          const isMaxTraineesDefinedForIntraOrSingleCoursesOnly = courseList
            .every(c => [INTRA, INTRA_HOLDING, SINGLE].includes(c.type) || !has(c, 'maxTrainees'));
          expect(isMaxTraineesDefinedForIntraOrSingleCoursesOnly).toBeTruthy();
        });

        it('should pass if number of trainees is lower than max trainees', () => {
          const isNumberOfTraineesLowerThanMaxTrainees = courseList
            .every(c => !c.maxTrainees || c.trainees.length <= c.maxTrainees);
          expect(isNumberOfTraineesLowerThanMaxTrainees).toBeTruthy();
        });

        it('should pass if expected bills count is defined only for intra or single courses', () => {
          const isExpectedBillsCountDefinedForBlendedCoursesOnly = courseList
            .every(c => [INTRA, SINGLE].includes(c.type) || !has(c, 'expectedBillsCount'));
          expect(isExpectedBillsCountDefinedForBlendedCoursesOnly).toBeTruthy();
        });

        it('should pass if every interlocutor exists', () => {
          const everyUserExists = courseList.every((c) => {
            const userList = [
              ...(has(c, 'companyRepresentative') ? [c.companyRepresentative] : []),
              ...(has(c, 'operationsRepresentative') ? [c.operationsRepresentative] : []),
              ...(has(c, 'trainers') ? c.trainers : []),
            ];

            return userList.every(u => u);
          });

          expect(everyUserExists).toBeTruthy();
        });

        it('should pass if company price is in company', () => {
          const everyPriceCompanyIsInCourse = courseList
            .filter(course => course.format === BLENDED)
            .every(course => get(course, 'prices', [])
              .every(price => !!UtilsHelper.doesArrayIncludeId(course.companies.map(c => c._id), price.company)));
          expect(everyPriceCompanyIsInCourse).toBeTruthy();
        });

        it('should pass if course price always contains global price', () => {
          const everyCoursePriceHasGlobalPrice = courseList
            .filter(course => course.format === BLENDED)
            .every(course => get(course, 'prices', [])
              .every(price => !!price.global));
          expect(everyCoursePriceHasGlobalPrice).toBeTruthy();
        });
      });

      describe('Collection CourseBill', () => {
        let courseBillList;
        before(async () => {
          courseBillList = await CourseBill
            .find()
            .populate({ path: 'course', select: 'type format companies type expectedBillsCount prices', transform })
            .populate({ path: 'companies', transform })
            .populate({ path: 'payer.company', transform })
            .populate({ path: 'payer.fundingOrganisation', transform })
            .populate({
              path: 'billingPurchaseList',
              select: 'billingItem',
              populate: { path: 'billingItem', transform },
            })
            .populate({ path: 'courseCreditNote', options: { allCompanies: true } })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if every course exists and is blended', () => {
          const everyCourseIsBlended = courseBillList.every(bill => get(bill, 'course.format') === BLENDED);

          expect(everyCourseIsBlended).toBeTruthy();
        });

        it('should pass if every price is positive', () => {
          const everyPriceIsValid = courseBillList.every(bill => !has(bill, 'mainFee.price') || bill.mainFee.price > 0);

          expect(everyPriceIsValid).toBeTruthy();
        });

        it('should pass if every validated invoice has price', () => {
          const priceIsMissing = courseBillList.some(bill => has(bill, 'billedAt') && !bill.mainFee.price > 0);

          expect(priceIsMissing).toBeFalsy();
        });

        it('should pass if every count is a positive integer', () => {
          const everyCountIsAValidInteger = courseBillList
            .every(bill => bill.mainFee.count > 0 && Number.isInteger(bill.mainFee.count));

          expect(everyCountIsAValidInteger).toBeTruthy();
        });

        it('should pass if every countUnit is group for intra course', () => {
          const everyCountUnitIsValid = courseBillList
            .every(bill => bill.course.type !== INTRA || bill.mainFee.countUnit === GROUP);

          expect(everyCountUnitIsValid).toBeTruthy();
        });

        it('should pass if every company exists', () => {
          const everyCompanyExists = courseBillList.every(bill => bill.companies.every(c => !!c));

          expect(everyCompanyExists).toBeTruthy();
        });

        it('should pass if every company is linked to course', () => {
          const everyCompanyIsLinkedToCourse = courseBillList
            .every(bill => bill.companies.every(c => UtilsHelper.doesArrayIncludeId(bill.course.companies, c._id)));

          expect(everyCompanyIsLinkedToCourse).toBeTruthy();
        });

        it('should pass if every payer exists', () => {
          const everyPayerExists = courseBillList.every(bill => !!bill.payer._id);

          expect(everyPayerExists).toBeTruthy();
        });

        it('should pass if every billing item exists', () => {
          const everyBillingItemExists = courseBillList
            .every(bill => bill.billingPurchaseList.every(purchase => !!purchase.billingItem));

          expect(everyBillingItemExists).toBeTruthy();
        });

        it('should pass if every billing purchase price is positive', () => {
          const everyPriceIsValid = courseBillList
            .every(bill => bill.billingPurchaseList.every(purchase => purchase.price > 0));

          expect(everyPriceIsValid).toBeTruthy();
        });

        it('should pass if every billing purchase count is a positive integer', () => {
          const everyCountIsAValidInteger = courseBillList
            .every(bill => bill.billingPurchaseList
              .every(purchase => purchase.count > 0 && Number.isInteger(purchase.count)));

          expect(everyCountIsAValidInteger).toBeTruthy();
        });

        it('should pass if every number has good format', () => {
          const everyNumberHasGoodFormat = courseBillList
            .every(bill => !bill.number || bill.number.match(/^FACT-[0-9]{5}$/));

          expect(everyNumberHasGoodFormat).toBeTruthy();
        });

        it('should pass if every number is unique', () => {
          const courseBillNumberList = compact(courseBillList.map(bill => bill.number));
          const courseBillNumbersWithoutDuplicates = [...new Set(courseBillNumberList)];

          expect(courseBillNumbersWithoutDuplicates.length).toEqual(courseBillNumberList.length);
        });

        it('should pass if no more active bill than expected', () => {
          const courseBillGroupedByCourse = groupBy(courseBillList, 'course._id');
          const everyBillCountIsLowerThanExpected = Object.keys(courseBillGroupedByCourse)
            .every((courseId) => {
              const { course } = courseBillGroupedByCourse[courseId][0];
              if (course.type !== INTRA) return true;

              const activeBills = courseBillGroupedByCourse[courseId].filter(b => !b.courseCreditNote);

              return activeBills.length <= course.expectedBillsCount;
            });

          expect(everyBillCountIsLowerThanExpected).toBeTruthy();
        });

        it('should pass if price is consistent with percentage and course price', () => {
          const everyBillPriceIsConsistent = courseBillList
            .filter(bill => bill.mainFee.percentage)
            .every((bill) => {
              const coursePrice = bill.course.prices.reduce((acc, price) => {
                if (UtilsHelper.doesArrayIncludeId(bill.companies.map(c => c._id), price.company)) {
                  return NumbersHelper.add(acc, price.global);
                }
                return acc;
              }, 0);

              return NumbersHelper.multiply(bill.mainFee.price, bill.mainFee.count)
                === NumbersHelper.divide(NumbersHelper.multiply(coursePrice, bill.mainFee.percentage), 100);
            });

          expect(everyBillPriceIsConsistent).toBeTruthy();
        });

        it('should pass if trainer fees are consistent with percentage and course trainer fees', () => {
          const everyBillPriceIsConsistent = courseBillList
            .filter(bill => bill.mainFee.percentage)
            .every((bill) => {
              const courseTrainerFees = bill.course.prices.reduce((acc, p) => {
                if (p.trainerFees && UtilsHelper.doesArrayIncludeId(bill.companies.map(c => c._id), p.company)) {
                  return NumbersHelper.add(acc, p.trainerFees);
                }
                return acc;
              }, 0);

              const trainerFeeBillinItem = bill.billingPurchaseList.find(purchase => UtilsHelper
                .areObjectIdsEquals(purchase.billingItem._id, process.env.TRAINER_FEES_BILLING_ITEM)
              );

              return NumbersHelper.multiply(trainerFeeBillinItem.price, trainerFeeBillinItem.count) === NumbersHelper
                .divide(NumbersHelper.multiply(courseTrainerFees, trainerFeeBillinItem.percentage), 100);
            });

          expect(everyBillPriceIsConsistent).toBeTruthy();
        });
      });

      describe('Collection CourseBillingItem', () => {
        let courseBillingItemList;
        before(async () => {
          courseBillingItemList = await CourseBillingItem.find().lean();
        });

        it('should pass if every name is unique', () => {
          const courseBillingItemNameList = courseBillingItemList.map(item => item.name);
          const courseBillingItemNamesWithoutDuplicates = [...new Set(courseBillingItemNameList)];

          expect(courseBillingItemNamesWithoutDuplicates.length).toEqual(courseBillingItemNameList.length);
        });
      });

      describe('Collection CourseBillsNumber', () => {
        let courseBillsNumberList;
        before(async () => {
          courseBillsNumberList = await CourseBillsNumber.find().lean();
        });

        it('should pass if only one item in list', () => {
          expect(courseBillsNumberList.length).toBeLessThanOrEqual(1);
        });

        it('should pass if value is a positive integer', () => {
          const isCourseBillsNumberAPositiveInteger = !courseBillsNumberList.length ||
            (courseBillsNumberList[0].seq > 0 && Number.isInteger(courseBillsNumberList[0].seq));

          expect(isCourseBillsNumberAPositiveInteger).toBeTruthy();
        });

        it('should pass if course bill number has good value', async () => {
          const courseBillCount = await CourseBill.countDocuments({ billedAt: { $exists: true } });

          if (!courseBillCount) expect(courseBillsNumberList.length).toEqual(0);
          else expect(courseBillsNumberList[0].seq).toEqual(courseBillCount);
        });
      });

      describe('Collection CourseCreditNote', () => {
        let courseCreditNoteList;
        before(async () => {
          courseCreditNoteList = await CourseCreditNote
            .find()
            .populate({ path: 'courseBill', select: 'companies billedAt', transform })
            .populate({ path: 'companies', transform })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if every number has good format', () => {
          const everyNumberHasGoodFormat = courseCreditNoteList
            .every(creditNote => creditNote.number.match(/^AV-[0-9]{5}$/));

          expect(everyNumberHasGoodFormat).toBeTruthy();
        });

        it('should pass if every course bill exists', () => {
          const everyCourseBillExists = courseCreditNoteList.every(creditNote => !!creditNote.courseBill);

          expect(everyCourseBillExists).toBeTruthy();
        });

        it('should pass if every course credit note has good company', () => {
          const everyCompanyExists = courseCreditNoteList.every(creditNote => creditNote.companies.every(c => !!c));

          expect(everyCompanyExists).toBeTruthy();
          const everyCompanyIsInCourseBill = courseCreditNoteList
            .every(cn => cn.companies.every(c => UtilsHelper.doesArrayIncludeId(cn.courseBill.companies, c._id)) &&
              cn.companies.length === cn.courseBill.companies.length);

          expect(everyCompanyIsInCourseBill).toBeTruthy();
        });

        it('should pass if every date is after billing', () => {
          const everyCourseBillIsBilled = courseCreditNoteList.every(creditNote => !!creditNote.courseBill.billedAt);

          expect(everyCourseBillIsBilled).toBeTruthy();

          const everyDateIsAfterBilling = courseCreditNoteList
            .every(creditNote => CompaniDate(creditNote.date).isAfter(creditNote.courseBill.billedAt));

          expect(everyDateIsAfterBilling).toBeTruthy();
        });
      });

      describe('Collection CourseCreditNoteNumber', () => {
        let courseCreditNoteNumberList;
        before(async () => {
          courseCreditNoteNumberList = await CourseCreditNoteNumber.find().lean();
        });

        it('should pass if only one item in list', () => {
          expect(courseCreditNoteNumberList.length).toBeLessThanOrEqual(1);
        });

        it('should pass if value is a positive integer', () => {
          const isCourseCreditNoteNumberAPositiveInteger = !courseCreditNoteNumberList.length ||
            (courseCreditNoteNumberList[0].seq > 0 && Number.isInteger(courseCreditNoteNumberList[0].seq));

          expect(isCourseCreditNoteNumberAPositiveInteger).toBeTruthy();
        });

        it('should pass if credit note number has good value', async () => {
          const courseCreditNoteCount = await CourseCreditNote.countDocuments();

          if (!courseCreditNoteCount) expect(courseCreditNoteNumberList.length).toEqual(0);
          else expect(courseCreditNoteNumberList[0].seq).toEqual(courseCreditNoteCount);
        });
      });

      describe('Collection CourseFundingOrganisation', () => {
        let courseFundingOrganisationsList;
        before(async () => {
          courseFundingOrganisationsList = await CourseFundingOrganisation.find().lean();
        });

        it('should pass if name is unique', () => {
          const organisationNameList = compact(courseFundingOrganisationsList.map(o => o.name.toLowerCase()));
          const organisationNamesWithoutDuplicates = [...new Set(organisationNameList)];

          expect(organisationNamesWithoutDuplicates.length).toEqual(courseFundingOrganisationsList.length);
        });
      });

      describe('Collection CoursePayment', () => {
        let coursePaymentList;
        before(async () => {
          coursePaymentList = await CoursePayment
            .find()
            .populate({ path: 'courseBill', select: 'companies billedAt', transform })
            .populate({ path: 'companies', transform })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if every number has good format', () => {
          const everyNumberHasGoodFormat = coursePaymentList
            .every(creditNote => creditNote.number.match(/^(REG|REMB)-[0-9]{5}$/));

          expect(everyNumberHasGoodFormat).toBeTruthy();
        });

        it('should pass if every course bill exists', () => {
          const everyCourseBillExists = coursePaymentList.every(payment => !!payment.courseBill);

          expect(everyCourseBillExists).toBeTruthy();
        });

        it('should pass if every course payment has good company', () => {
          const everyCompanyExists = coursePaymentList.every(payment => payment.companies.every(c => !!c));

          expect(everyCompanyExists).toBeTruthy();

          const everyCompanyIsInCourseBill = coursePaymentList
            .every(payment => payment.companies.length === payment.courseBill.companies.length &&
              payment.companies.every(c => UtilsHelper.doesArrayIncludeId(payment.courseBill.companies, c._id))
            );

          expect(everyCompanyIsInCourseBill).toBeTruthy();
        });

        it('should pass if every date is after billing', () => {
          const everyCourseBillIsBilled = coursePaymentList.every(payment => !!payment.courseBill.billedAt);

          expect(everyCourseBillIsBilled).toBeTruthy();

          const everyDateIsAfterBilling = coursePaymentList
            .every(payment => CompaniDate(payment.date).isAfter(payment.courseBill.billedAt));

          expect(everyDateIsAfterBilling).toBeTruthy();
        });

        it('should pass if nature is consistent with number', () => {
          const everyNatureIsConsistent = coursePaymentList
            .every(payment => (
              payment.nature === PAYMENT
                ? payment.number.match(/^REG-[0-9]{5}$/)
                : payment.number.match(/^REMB-[0-9]{5}$/)
            ));

          expect(everyNatureIsConsistent).toBeTruthy();
        });
      });

      describe('Collection CoursePaymentNumber', () => {
        let coursePaymentNumberList;
        before(async () => {
          coursePaymentNumberList = await CoursePaymentNumber.find().lean();
        });

        it('should pass if no more thant 2 items in list and they have different nature', () => {
          expect(coursePaymentNumberList.length).toBeLessThanOrEqual(2);

          const paymentsNaturesWithoutDuplicates = [...new Set(coursePaymentNumberList.map(payment => payment.nature))];
          expect(paymentsNaturesWithoutDuplicates.length).toEqual(coursePaymentNumberList.length);
        });

        it('should pass if value is a positive integer', () => {
          const areCoursePaymentNumbersPositiveIntegers = coursePaymentNumberList
            .every(number => number.seq > 0 && Number.isInteger(number.seq));

          expect(areCoursePaymentNumbersPositiveIntegers).toBeTruthy();
        });

        it('should pass if course payment number has good value', async () => {
          const coursePaymentList = await CoursePayment.find().setOptions({ allCompanies: true }).lean();

          if (!coursePaymentList.length) expect(coursePaymentNumberList.length).toEqual(0);
          else {
            const paymentCount = coursePaymentList.filter(payment => payment.nature === PAYMENT).length;
            const refundCount = coursePaymentList.filter(payment => payment.nature === REFUND).length;

            const paymentNumber = coursePaymentNumberList.find(n => n.nature === PAYMENT);
            if (paymentCount) expect(paymentNumber.seq).toEqual(paymentCount);
            else expect(paymentNumber).toBeUndefined();

            const refundNumber = coursePaymentNumberList.find(n => n.nature === REFUND);
            if (refundCount) expect(refundNumber.seq).toEqual(refundCount);
            else expect(refundNumber).toBeUndefined();
          }
        });
      });

      describe('Collection CourseSlot', () => {
        let courseSlotList;
        before(async () => {
          courseSlotList = await CourseSlot
            .find()
            .populate({
              path: 'course',
              select: 'format subProgram',
              populate: { path: 'subProgram', select: 'steps' },
              transform,
            })
            .populate({ path: 'step', select: 'type', transform })
            .lean();
        });

        it('should pass if every course exists and is blended', () => {
          const everyCourseIsBlended = courseSlotList.every(cs => cs.course && cs.course.format === BLENDED);
          expect(everyCourseIsBlended).toBeTruthy();
        });

        it('should pass if every startDate is before endDate and same day', () => {
          const everyStartDateIsBeforeEndDateInTheDay = courseSlotList
            .every(cs => !has(cs, 'startDate') ||
              (CompaniDate(cs.startDate).isBefore(cs.endDate) &&
                CompaniDate(cs.startDate).isSame(CompaniDate(cs.endDate), DAY))
            );
          expect(everyStartDateIsBeforeEndDateInTheDay).toBeTruthy();
        });

        it('should pass if addresses are on site slots only', () => {
          const areAddressesOnSiteSlotsOnly = courseSlotList
            .every(cs => !has(cs, 'address') || cs.step.type === ON_SITE);
          expect(areAddressesOnSiteSlotsOnly).toBeTruthy();
        });

        it('should pass if links are on remote slots only', () => {
          const areLinksOnRemoteSlotsOnly = courseSlotList
            .every(cs => !has(cs, 'meetingLink') || cs.step.type === REMOTE);
          expect(areLinksOnRemoteSlotsOnly).toBeTruthy();
        });

        it('should pass if step exists and is in course', () => {
          const everyStepIsInCourse = courseSlotList
            .every(cs => cs.step && UtilsHelper.doesArrayIncludeId(cs.course.subProgram.steps, cs.step._id));
          expect(everyStepIsInCourse).toBeTruthy();
        });
      });

      describe('Collection CourseSmsHistory', () => {
        let courseSmsHistoryList;
        before(async () => {
          courseSmsHistoryList = await CourseSmsHistory
            .find({})
            .populate({ path: 'course', select: 'format type companies trainers' })
            .populate({
              path: 'sender',
              select: 'role',
              transform,
              populate: [
                { path: 'role.vendor', select: 'name' },
                { path: 'role.client', select: 'name' },
                { path: 'company' },
              ],
            })
            .lean();
        });

        it('should pass if every course exists and is blended', () => {
          const areCoursesBlended = courseSmsHistoryList.every(ch => ch.course.format === BLENDED);
          expect(areCoursesBlended).toBeTruthy();
        });

        it('should pass if every sender exists and has good role', () => {
          const haveSendersGoodRole = courseSmsHistoryList
            .every(ch =>
              ([CLIENT_ADMIN, COACH].includes(get(ch.sender, 'role.client.name')) && ch.course.type === INTRA) ||
              ([VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER, TRAINER].includes(get(ch.sender, 'role.vendor.name')))
            );
          expect(haveSendersGoodRole).toBeTruthy();
        });

        it('should pass if every sender is allowed to access course', () => {
          const areSendersAllowedToAccessCourse = courseSmsHistoryList
            .every((ch) => {
              const vendorRole = get(ch.sender, 'role.vendor.name');
              if ([VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(vendorRole)) return true;

              const { course } = ch;
              const isCourseTrainer = vendorRole === TRAINER &&
                UtilsHelper.doesArrayIncludeId(course.trainers, ch.sender._id);
              if (isCourseTrainer) return true;

              const clientRole = get(ch.sender, 'role.client.name');
              const isFromCourseCompany = UtilsHelper.doesArrayIncludeId(course.companies, ch.sender.company);
              if ([CLIENT_ADMIN, COACH].includes(clientRole) && isFromCourseCompany) return true;

              return false;
            });
          expect(areSendersAllowedToAccessCourse).toBeTruthy();
        });

        it('should pass if every missing phone user exists and is registered to course', async () => {
          const missingPhonesList = courseSmsHistoryList.flatMap(ch => ch.missingPhones);
          const missingPhonesAdditionHistories = await CourseHistory
            .find({ trainee: { $in: missingPhonesList }, action: TRAINEE_ADDITION })
            .lean();
          const areMissingPhonesRegisteredToCourse = courseSmsHistoryList
            .every(ch => ch.missingPhones
              .every(user => missingPhonesAdditionHistories
                .find(history => UtilsHelper.areObjectIdsEquals(history.trainee, user._id) &&
                  UtilsHelper.areObjectIdsEquals(history.course, ch.course._id)
                )
              )
            );
          expect(areMissingPhonesRegisteredToCourse).toBeTruthy();
        });
      });

      describe('Collection CourseHistory', () => {
        let courseHistoryList;
        before(async () => {
          courseHistoryList = await CourseHistory
            .find({})
            .populate({ path: 'trainee', select: '_id', transform, populate: { path: 'userCompanyList' } })
            .populate({ path: 'company', select: '_id', transform })
            .populate({
              path: 'createdBy',
              select: '_id role',
              transform,
              populate: [
                { path: 'role.vendor', select: 'name' },
                { path: 'role.client', select: 'name' },
                { path: 'userCompanyList' },
              ],
            })
            .populate({ path: 'course', select: 'trainers companies trainees' })
            .lean();
        });

        it('should pass if user who created history exists', () => {
          const everyHistoryCreatorExists = courseHistoryList.every(ch => !!ch.createdBy);
          expect(everyHistoryCreatorExists).toBeTruthy();
        });

        it('should pass if user who created history has good role', () => {
          const everyHistoryCreatorHasGoodRole = courseHistoryList.every((ch) => {
            const rofOrVendorAdminActions = [
              SLOT_CREATION,
              ESTIMATED_START_DATE_EDITION,
              COMPANY_ADDITION,
              COMPANY_DELETION,
            ];
            const otherActions = [
              SLOT_DELETION,
              SLOT_EDITION,
              TRAINEE_ADDITION,
              TRAINEE_DELETION,
            ];

            const hasRofOrVendorAdminRole = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
              .includes(get(ch.createdBy, 'role.vendor.name'));
            const hasCourseEditionRole = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN, TRAINER]
              .includes(get(ch.createdBy, 'role.vendor.name')) ||
              [COACH, CLIENT_ADMIN].includes(get(ch.createdBy, 'role.client.name'));

            if (rofOrVendorAdminActions.includes(ch.action) && !hasRofOrVendorAdminRole) return false;
            if (otherActions.includes(ch.action) && !hasCourseEditionRole) return false;

            return true;
          });
          expect(everyHistoryCreatorHasGoodRole).toBeTruthy();
        });

        it('should pass if user who created history is allowed to access course', () => {
          const everyHistoryCreatorIsAllowedToAccessCourse = courseHistoryList.every((ch) => {
            const hasRofOrVendorAdminRole = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
              .includes(get(ch.createdBy, 'role.vendor.name'));

            const isCourseTrainer = get(ch.createdBy, 'role.vendor.name') === TRAINER &&
              UtilsHelper.doesArrayIncludeId(ch.course.trainers, ch.createdBy._id);

            const isFromCompanyLinkedToCourse = [COACH, CLIENT_ADMIN].includes(get(ch.createdBy, 'role.client.name')) &&
              ch.course.type === INTRA &&
              ch.createdBy.userCompanyList.some(uc => UtilsHelper.doesArrayIncludeId(ch.course.companies, uc.company));

            if (hasRofOrVendorAdminRole || isCourseTrainer || isFromCompanyLinkedToCourse) return true;

            return false;
          });
          expect(everyHistoryCreatorIsAllowedToAccessCourse).toBeTruthy();
        });

        it('should pass if trainee is in course for trainee_addition action', () => {
          const isEveryTraineeInCourse = courseHistoryList
            .filter(ch => ch.action === TRAINEE_ADDITION)
            .every((ch) => {
              if (UtilsHelper.doesArrayIncludeId(ch.course.trainees, ch.trainee._id)) return true;

              const traineeDeletions = courseHistoryList
                .filter(
                  history => history.action === TRAINEE_DELETION &&
                  UtilsHelper.areObjectIdsEquals(history.trainee._id, ch.trainee._id) &&
                  UtilsHelper.areObjectIdsEquals(history.course._id, ch.course._id)
                );

              const traineeAdditions = courseHistoryList
                .filter(
                  history => history.action === TRAINEE_ADDITION &&
                  UtilsHelper.areObjectIdsEquals(history.trainee._id, ch.trainee._id) &&
                  UtilsHelper.areObjectIdsEquals(history.course._id, ch.course._id)
                );

              return traineeDeletions.length === traineeAdditions.length;
            });

          expect(isEveryTraineeInCourse).toBeTruthy();
        });

        it('should pass if course exists', () => {
          const everyCourseExists = courseHistoryList.every(ch => !!ch.course);
          expect(everyCourseExists).toBeTruthy();
        });

        it('should pass if none history has address and meeting link fields', () => {
          const someHistoryHaveAddressAndMeetingLink = courseHistoryList
            .filter(ch => has(ch, 'slot'))
            .some(ch => ch.slot.address && ch.slot.meetingLink);

          expect(someHistoryHaveAddressAndMeetingLink).toBeFalsy();
        });

        it('should pass if startDate is before endDate', () => {
          const everyStartDateIsBeforeEndDate = courseHistoryList
            .every(ch => !has(ch, 'slot') || CompaniDate(ch.slot.startDate).isBefore(ch.slot.endDate));

          expect(everyStartDateIsBeforeEndDate).toBeTruthy();
        });

        it('should pass if histories with slot have good action', () => {
          const everyHistoryWithSlotHasGoodAction = courseHistoryList
            .every(ch => !has(ch, 'slot') || [SLOT_CREATION, SLOT_DELETION, SLOT_EDITION].includes(ch.action));

          expect(everyHistoryWithSlotHasGoodAction).toBeTruthy();
        });

        it('should pass if startHour is before endHour', () => {
          const everyStartDateIsBeforeEndDate = courseHistoryList
            .every(ch => !has(ch, 'update.startHour') ||
              CompaniDate(ch.update.startHour.to).isBefore(ch.update.endHour.to));

          expect(everyStartDateIsBeforeEndDate).toBeTruthy();
        });

        it('should pass if estimatedStartDate is the only field in update and has good action', () => {
          const everyStartDateIsBeforeEndDate = courseHistoryList
            .every(ch => !has(ch, 'update.estimatedStartDate') ||
              (Object.keys(ch.update).length === 1 && ch.action === ESTIMATED_START_DATE_EDITION));

          expect(everyStartDateIsBeforeEndDate).toBeTruthy();
        });

        it('should pass if trainee exists', () => {
          const everyTraineeExists = courseHistoryList
            .every(ch => ![TRAINEE_ADDITION, TRAINEE_DELETION].includes(ch.action) || !!ch.trainee);
          expect(everyTraineeExists).toBeTruthy();
        });

        it('should pass if all trainees are in course company at registration', () => {
          const traineeHistoryList = courseHistoryList
            .filter(ch => [TRAINEE_ADDITION, TRAINEE_DELETION].includes(ch.action));
          const courseHistoriesGroupedByCourse = groupBy(traineeHistoryList, 'course._id');

          for (const courseHistories of Object.values(courseHistoriesGroupedByCourse)) {
            const courseHistoriesGroupedByTrainee = groupBy(courseHistories, 'trainee._id');

            for (const traineeCourseHistories of Object.values(courseHistoriesGroupedByTrainee)) {
              const lastHistory = traineeCourseHistories.sort(descendingSortBy('createdAt'))[0];
              const isTraineeInCompanyBeforeAction = traineeCourseHistories.sort(ascendingSortBy('createdAt'))
                .every((ch, i) => {
                  if (i % 2 === 0) {
                    return ch.action === TRAINEE_ADDITION && ch.trainee.userCompanyList
                      .some(uc => UtilsHelper.areObjectIdsEquals(uc.company, ch.company._id));
                  }

                  return ch.action === TRAINEE_DELETION;
                });
              expect(isTraineeInCompanyBeforeAction).toBeTruthy();

              const isLastHistoryAddition = lastHistory.action === TRAINEE_ADDITION;

              let isTraineeStillInCompanyAtRegistration = true;
              if (isLastHistoryAddition) {
                isTraineeStillInCompanyAtRegistration = lastHistory.trainee.userCompanyList.some(uc =>
                  UtilsHelper.areObjectIdsEquals(uc.company, lastHistory.company._id) &&
                    (!uc.endDate || CompaniDate(lastHistory.createdAt).isBefore(uc.endDate))
                );
              }

              expect(!isLastHistoryAddition || isTraineeStillInCompanyAtRegistration).toBeTruthy();
            }
          }
        });

        it('should pass if company exists', () => {
          const everyCompanyExists = courseHistoryList
            .every(ch => ![COMPANY_ADDITION, COMPANY_DELETION, TRAINEE_ADDITION].includes(ch.action) || !!ch.company);
          expect(everyCompanyExists).toBeTruthy();
        });

        it('should pass if company is in course', () => {
          const everyCompanyExists = courseHistoryList
            .every((ch) => {
              if (![COMPANY_ADDITION, TRAINEE_ADDITION].includes(ch.action)) return true;

              const isCompanyInCourse = UtilsHelper.doesArrayIncludeId(ch.course.companies, ch.company._id);

              const companyDeletions = courseHistoryList
                .filter(
                  history => history.action === COMPANY_DELETION &&
                  UtilsHelper.areObjectIdsEquals(history.company._id, ch.company._id) &&
                  UtilsHelper.areObjectIdsEquals(history.course._id, ch.course._id)
                );

              const companyAdditions = courseHistoryList
                .filter(
                  history => history.action === COMPANY_ADDITION &&
                  UtilsHelper.areObjectIdsEquals(history.company._id, ch.company._id) &&
                  UtilsHelper.areObjectIdsEquals(history.course._id, ch.course._id)
                );

              const hasCompanyBeenRemoved = companyDeletions.length === companyAdditions.length;

              return isCompanyInCourse || hasCompanyBeenRemoved;
            });
          expect(everyCompanyExists).toBeTruthy();
        });
      });

      describe('Collection Helper', () => {
        let helperList;
        before(async () => {
          helperList = await Helper
            .find()
            .populate({ path: 'user', select: '_id', populate: { path: 'userCompanyList' } })
            .populate({ path: 'company', select: '_id' })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if every company exists', () => {
          const companiesExist = helperList.map(helper => helper.company).every(company => !!company);
          expect(companiesExist).toBeTruthy();
        });

        it('should pass if every user exists', () => {
          const usersExist = helperList.map(helper => helper.user).every(user => !!user);
          expect(usersExist).toBeTruthy();
        });

        it('should pass if every helper has a matching user and company', () => {
          const areUserAndCompanyMatching = helperList
            .every(helper => helper.user.userCompanyList
              .some(uc => UtilsHelper.areObjectIdsEquals(uc.company, helper.company._id))
            );
          expect(areUserAndCompanyMatching).toBeTruthy();
        });
      });

      describe('Collection IdentityVerification', () => {
        let identityVerificationList;
        before(async () => {
          identityVerificationList = await IdentityVerification.find().lean();
        });

        it('should pass if no email is linked to severals codes', async () => {
          const emailListWithoutDuplicates = [...new Set(identityVerificationList.map(iv => iv.email))];

          expect(emailListWithoutDuplicates.length).toEqual(identityVerificationList.length);
        });

        it('should pass if every email match a user', async () => {
          const emailList = identityVerificationList.map(iv => iv.email);
          const usersCount = await User.countDocuments({ 'local.email': { $in: emailList } });

          expect(emailList.length).toEqual(usersCount);
        });
      });

      describe('Collection Program', () => {
        let programList;
        before(async () => {
          programList = await Program
            .find()
            .populate({ path: 'subPrograms', select: '_id', transform })
            .populate({ path: 'categories', select: '_id', transform })
            .populate({
              path: 'testers',
              select: '_id',
              transform,
              populate: { path: 'role.vendor', select: 'name' },
            })
            .lean();
        });

        it('should pass if every subprogram exists and is not duplicated in same or different program', () => {
          const everySubProgramExists = programList.every(p => p.subPrograms.every(subProgram => subProgram));

          expect(everySubProgramExists).toBeTruthy();

          const subProgramsList = programList
            .flatMap(program => program.subPrograms.map(sp => sp._id.toHexString()));
          const subProgramsWithoutDuplicates = [...new Set(subProgramsList)];

          expect(subProgramsWithoutDuplicates.length).toEqual(subProgramsList.length);
        });

        it('should pass if every category exists and is not duplicated', () => {
          const everyCategoryExists = programList.every(p => p.categories.every(category => category));

          expect(everyCategoryExists).toBeTruthy();

          const someCategoriesAreDuplicated = programList
            .some((program) => {
              const categoriesWithoutDuplicates = [...new Set(program.categories.map(c => c._id.toHexString()))];

              return program.categories.length !== categoriesWithoutDuplicates.length;
            });

          expect(someCategoriesAreDuplicated).toBeFalsy();
        });

        it('should pass if every tester exists and is not duplicated', () => {
          const everyTesterExists = programList.every(p => p.testers.every(tester => tester));

          expect(everyTesterExists).toBeTruthy();

          const someTestersAreDuplicated = programList
            .some((program) => {
              const testersWithoutDuplicates = [...new Set(program.testers.map(t => t._id.toHexString()))];

              return program.testers.length !== testersWithoutDuplicates.length;
            });

          expect(someTestersAreDuplicated).toBeFalsy();
        });

        it('should pass if testers are not rof or vendor admin', () => {
          const someTestersAreRofOrVendorAdmin = programList
            .some(p => p.testers
              .some(tester => [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(tester, 'role.vendor.name'))));

          expect(someTestersAreRofOrVendorAdmin).toBeFalsy();
        });
      });

      describe('Collection Questionnaire', () => {
        let questionnaireList;
        before(async () => {
          questionnaireList = await Questionnaire
            .find()
            .populate({ path: 'cards', select: '-__v -createdAt -updatedAt', transform })
            .lean({ virtuals: true });
        });

        it('should pass if every card exists and is not duplicated', () => {
          const everyCardExists = questionnaireList.every(questionnaire => questionnaire.cards.every(card => card));

          expect(everyCardExists).toBeTruthy();

          const someCardsAreDuplicated = questionnaireList
            .some((questionnaire) => {
              const cardsWithoutDuplicates = [...new Set(questionnaire.cards.map(card => card._id.toHexString()))];

              return questionnaire.cards.length !== cardsWithoutDuplicates.length;
            });

          expect(someCardsAreDuplicated).toBeFalsy();
        });

        it('should pass if some cards have questionnaire template', () => {
          const noneCardsHasQuestionnaireTemplate = questionnaireList
            .some(questionnaire => questionnaire.cards
              .every(card => ![OPEN_QUESTION, SURVEY, QUESTION_ANSWER].includes(card.template)));

          expect(noneCardsHasQuestionnaireTemplate).toBeFalsy();
        });

        it('should pass if published questionnaires have at least one card', () => {
          const everyPublishedQuestionnaireHasCards = questionnaireList
            .every(questionnaire => questionnaire.status === DRAFT || questionnaire.cards.length);

          expect(everyPublishedQuestionnaireHasCards).toBeTruthy();
        });

        it('should pass if published questionnaires have all their cards valid', () => {
          const everyPublishedQuestionnaireHasValidCards = questionnaireList
            .every(questionnaire => questionnaire.status === DRAFT || questionnaire.areCardsValid);

          expect(everyPublishedQuestionnaireHasValidCards).toBeTruthy();
        });
      });

      describe('Collection QuestionnaireHistory', () => {
        let questionnaireHistoryList;
        before(async () => {
          questionnaireHistoryList = await QuestionnaireHistory
            .find()
            .populate({ path: 'user', select: 'id', populate: { path: 'userCompanyList' } })
            .populate({ path: 'company', select: 'id' })
            .populate({ path: 'course', select: 'id type companies' })
            .populate({
              path: 'questionnaire',
              select: '_id cards status type',
              populate: { path: 'cards' },
              transform,
            })
            .populate({ path: 'questionnaireAnswersList.card', select: 'template', transform })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if all questionnaire history\'s user are in questionnaire history\'s company', () => {
          const areUsersInCompany = questionnaireHistoryList
            .every(questionnaireHistory => questionnaireHistory.user.userCompanyList
              .some(uc => UtilsHelper.areObjectIdsEquals(uc.company, questionnaireHistory.company._id))
            );
          expect(areUsersInCompany).toBeTruthy();
        });

        it('should pass if every course exists', () => {
          const everyCourseExists = questionnaireHistoryList.every(qh => qh.course);

          expect(everyCourseExists).toBeTruthy();
        });

        it('should pass if every user exists', () => {
          const everyUserExists = questionnaireHistoryList.every(qh => qh.user);

          expect(everyUserExists).toBeTruthy();
        });

        it('should pass if user is registered to course', async () => {
          const trainees = questionnaireHistoryList.map(qh => qh.user._id);
          const courses = questionnaireHistoryList.map(qh => qh.course._id);
          const histories = await CourseHistory
            .find({ trainee: { $in: trainees }, course: { $in: courses }, action: TRAINEE_ADDITION })
            .lean();
          const everyUserIsRegisteredToCourse = questionnaireHistoryList
            .every(qh => histories
              .some(
                history => UtilsHelper.areObjectIdsEquals(history.trainee, qh.user._id) &&
                  UtilsHelper.areObjectIdsEquals(history.course, qh.course._id)
              )
            );
          expect(everyUserIsRegisteredToCourse).toBeTruthy();
        });

        it('should pass if users only answer once to questionnaire (EXPECTATIONS and END_OF_COURSE)', async () => {
          const questionnaireHistoriesGroupedByCourse = groupBy(
            questionnaireHistoryList.filter(qh => qh.questionnaire.type !== SELF_POSITIONNING),
            'course._id'
          );

          const someUserHaveAnsweredSeveralTimeToQuestionnaires = Object.keys(questionnaireHistoriesGroupedByCourse)
            .some((courseId) => {
              const uniqueExpectationQuestionnaireRespondants = [
                ...new Set(
                  questionnaireHistoriesGroupedByCourse[courseId]
                    .filter(qh => qh.questionnaire.type === EXPECTATIONS)
                    .map(qh => qh.user._id.toHexString())
                ),
              ];

              const uniqueEndOfCourseQuestionnaireRespondants = [
                ...new Set(
                  questionnaireHistoriesGroupedByCourse[courseId]
                    .filter(qh => qh.questionnaire.type === END_OF_COURSE)
                    .map(qh => qh.user._id.toHexString())
                ),
              ];

              return questionnaireHistoriesGroupedByCourse[courseId].length
                !== (uniqueExpectationQuestionnaireRespondants.length
                  + uniqueEndOfCourseQuestionnaireRespondants.length);
            });

          expect(someUserHaveAnsweredSeveralTimeToQuestionnaires).toBeFalsy();
        });

        it('should pass if users answer SELF_POSITIONNING questionnaire max 2 times (with '
          + 'a different timeline)', async () => {
          const questionnaireHistoriesGroupedByCourse = groupBy(
            questionnaireHistoryList.filter(qh => qh.questionnaire.type === SELF_POSITIONNING),
            'course._id'
          );

          const someUserHaveAnsweredMoreThanTwiceSameQuestionnaire = Object.keys(questionnaireHistoriesGroupedByCourse)
            .some((courseId) => {
              const uniqueStartSelfPositionningQuestionnaireRespondants = [
                ...new Set(
                  questionnaireHistoriesGroupedByCourse[courseId]
                    .filter(qh => qh.timeline === START_COURSE)
                    .map(qh => qh.user._id.toHexString())
                ),
              ];

              const uniqueEndSelfPositionningQuestionnaireRespondants = [
                ...new Set(
                  questionnaireHistoriesGroupedByCourse[courseId]
                    .filter(qh => qh.timeline === END_COURSE)
                    .map(qh => qh.user._id.toHexString())
                ),
              ];

              return questionnaireHistoriesGroupedByCourse[courseId].length
                !== (uniqueStartSelfPositionningQuestionnaireRespondants.length
                  + uniqueEndSelfPositionningQuestionnaireRespondants.length);
            });

          expect(someUserHaveAnsweredMoreThanTwiceSameQuestionnaire).toBeFalsy();
        });

        it('should pass if every questionnaire exists and is published', () => {
          const everyQuestionnaireExists = questionnaireHistoryList
            .every(qh => qh.questionnaire && qh.questionnaire.status === PUBLISHED);

          expect(everyQuestionnaireExists).toBeTruthy();
        });

        it('should pass if every card exists and is in questionnaire', () => {
          const everyCardExists = questionnaireHistoryList
            .every(qh => qh.questionnaireAnswersList.every(qal => qal.card));

          expect(everyCardExists).toBeTruthy();

          const someCardsAreNotInQuestionnaires = questionnaireHistoryList
            .some((qh) => {
              const cardIds = qh.questionnaire.cards.map(c => c._id);

              return qh.questionnaireAnswersList.some(qal => !UtilsHelper.doesArrayIncludeId(cardIds, qal.card._id));
            });

          expect(someCardsAreNotInQuestionnaires).toBeFalsy();
        });

        it('should pass if every questionnaire answers list card is a questionnaire card', () => {
          const everyCardHasGoodTemplate = questionnaireHistoryList
            .every(qh => qh.questionnaireAnswersList
              .every(qal => [SURVEY, OPEN_QUESTION, QUESTION_ANSWER].includes(qal.card.template)));

          expect(everyCardHasGoodTemplate).toBeTruthy();
        });

        it('should pass if every mandatory card has answer', () => {
          const everyMandatoryCardHasAnswer = questionnaireHistoryList
            .every(qh => qh.questionnaire.cards
              .every(c => !c.isMandatory ||
              qh.questionnaireAnswersList.some(qal => UtilsHelper.areObjectIdsEquals(c._id, qal.card._id)))
            );

          expect(everyMandatoryCardHasAnswer).toBeTruthy();
        });

        it('should pass if there is the good answers number', () => {
          const everyHistoryHasGoodAnswersNumber = questionnaireHistoryList
            .every(qh => qh.questionnaireAnswersList.length &&
              qh.questionnaireAnswersList
                .every(qal => qal.answerList.length === 1 || qal.card.template === QUESTION_ANSWER));

          expect(everyHistoryHasGoodAnswersNumber).toBeTruthy();
        });

        it('should pass if every company exists', () => {
          const everyCompanyExists = questionnaireHistoryList.every(qh => qh.company);

          expect(everyCompanyExists).toBeTruthy();
        });

        it('should pass if company is linked to course', async () => {
          const companies = questionnaireHistoryList.map(qh => qh.company._id);
          const courses = questionnaireHistoryList.map(qh => qh.course._id);
          const histories = await CourseHistory
            .find({ company: { $in: companies }, course: { $in: courses }, action: COMPANY_ADDITION })
            .lean();
          const everyCompanyIsLinkedToCourse = questionnaireHistoryList
            .every((qh) => {
              if ([SINGLE, INTRA].includes(qh.course.type)) {
                return UtilsHelper.areObjectIdsEquals(qh.company._id, qh.course.companies[0]);
              }
              return histories
                .some(
                  history => UtilsHelper.areObjectIdsEquals(history.company, qh.company._id) &&
                    UtilsHelper.areObjectIdsEquals(history.course, qh.course._id)
                );
            });
          expect(everyCompanyIsLinkedToCourse).toBeTruthy();
        });

        it('should pass if user is registered to course with company', async () => {
          const companies = questionnaireHistoryList.map(qh => qh.company._id);
          const trainees = questionnaireHistoryList.map(qh => qh.user._id);
          const courses = questionnaireHistoryList.map(qh => qh.course._id);
          const histories = await CourseHistory
            .find({
              company: { $in: companies },
              trainee: { $in: trainees },
              course: { $in: courses },
              action: TRAINEE_ADDITION,
            })
            .lean();
          const everyTraineeIsRegisteredToCourseWithCompany = questionnaireHistoryList
            .every(qh => histories
              .some(
                history => UtilsHelper.areObjectIdsEquals(history.company, qh.company._id) &&
                  UtilsHelper.areObjectIdsEquals(history.trainee, qh.user._id) &&
                  UtilsHelper.areObjectIdsEquals(history.course, qh.course._id)
              )
            );
          expect(everyTraineeIsRegisteredToCourseWithCompany).toBeTruthy();
        });

        it('should pass if timeline is defined for every SELF_POSITIONNING questionnaire', () => {
          const everySelfPositionningHistoryHasTimeline = questionnaireHistoryList
            .filter(qh => qh.questionnaire.type === SELF_POSITIONNING)
            .every(qh => qh.timeline);

          expect(everySelfPositionningHistoryHasTimeline).toBeTruthy();
        });

        it('should pass if every trainee\'s answer is authorized (SELF POSITIONNING QUESTIONNAIRE)', () => {
          const everySelfPositionningHistoryHasAuthorizedTraineeAnswer = questionnaireHistoryList
            .filter(qh => qh.questionnaire.type === SELF_POSITIONNING)
            .every(qh => qh.questionnaireAnswersList.every(a => ['1', '2', '3', '4', '5'].includes(a.answerList[0])));

          expect(everySelfPositionningHistoryHasAuthorizedTraineeAnswer).toBeTruthy();
        });

        it('should pass if every trainer\'s answer is authorized (SELF POSITIONNING QUESTIONNAIRE)', () => {
          const everySelfPositionningHistoryHasAuthorizedTrainerAnswer = questionnaireHistoryList
            .filter(qh => qh.questionnaire.type === SELF_POSITIONNING)
            .every(qh => qh.questionnaireAnswersList
              .every(a => !a.trainerAnswerList || ['1', '2', '3', '4', '5'].includes(a.trainerAnswerList[0])));

          expect(everySelfPositionningHistoryHasAuthorizedTrainerAnswer).toBeTruthy();
        });

        it('should pass if validated histories are linked to end self-positioning questionnaire', () => {
          const everySelfPositionningHistoryHasAuthorizedTrainerAnswer = questionnaireHistoryList
            .filter(qh => qh.isValidated)
            .every(qh => qh.questionnaire.type === SELF_POSITIONNING && qh.timeline === END_COURSE);

          expect(everySelfPositionningHistoryHasAuthorizedTrainerAnswer).toBeTruthy();
        });
      });

      describe('Collection Step', () => {
        let stepList;
        before(async () => {
          stepList = await Step
            .find()
            .populate({ path: 'activities', select: '_id status', transform })
            .lean();
        });

        it('should pass if every activity exists and is not duplicated', () => {
          const everyActivityExists = stepList.every(step => step.activities.every(activity => activity));

          expect(everyActivityExists).toBeTruthy();

          const someActivitiesAreDuplicated = stepList
            .some((step) => {
              const activitiesWithoutDuplicates = [...new Set(step.activities.map(a => a._id.toHexString()))];

              return step.activities.length !== activitiesWithoutDuplicates.length;
            });

          expect(someActivitiesAreDuplicated).toBeFalsy();
        });

        it('should pass if no live step has actvities', () => {
          const someLiveStepHaveActivities = stepList.some(step => step.type !== E_LEARNING && step.activities.length);

          expect(someLiveStepHaveActivities).toBeFalsy();
        });

        it('should pass if published steps have theoretical duration', () => {
          const everyPublishedStepHasTheoreticalDuration = stepList
            .every(step => step.status === DRAFT || step.theoreticalDuration);

          expect(everyPublishedStepHasTheoreticalDuration).toBeTruthy();
        });

        it('should pass if published elearning steps have at least one activity', () => {
          const everyElearningPublishedStepHasActivities = stepList
            .filter(step => step.type === E_LEARNING && step.status === PUBLISHED)
            .every(step => step.activities.length);

          expect(everyElearningPublishedStepHasActivities).toBeTruthy();
        });

        it('should pass if every activity in published steps is published', () => {
          const everyPublishedStepHasPublishedActivities = stepList
            .filter(step => step.type === E_LEARNING && step.status === PUBLISHED)
            .every(step => step.activities.every(activity => activity.status === PUBLISHED));

          expect(everyPublishedStepHasPublishedActivities).toBeTruthy();
        });

        it('should pass if theoretical duration is a positive integer', () => {
          const theoreticalDurationIsPositiveInteger = stepList
            .every((step) => {
              if (!has(step, 'theoreticalDuration')) return true;

              const durationInMinutes = CompaniDuration(step.theoreticalDuration).asMinutes();
              return (Number.isInteger(durationInMinutes) && durationInMinutes > 0);
            });

          expect(theoreticalDurationIsPositiveInteger).toBeTruthy();
        });
      });

      describe('Collection SubProgram', () => {
        let subProgramList;
        before(async () => {
          subProgramList = await SubProgram
            .find()
            .populate({ path: 'steps', select: '_id status', transform })
            .lean();
        });

        it('should pass if every step exists and is not duplicated', () => {
          const everyStepExists = subProgramList.every(sp => sp.steps.every(step => step));

          expect(everyStepExists).toBeTruthy();

          const someStepsAreDuplicated = subProgramList
            .some((subProgram) => {
              const stepsWithoutDuplicates = [...new Set(subProgram.steps.map(step => step._id.toHexString()))];

              return subProgram.steps.length !== stepsWithoutDuplicates.length;
            });

          expect(someStepsAreDuplicated).toBeFalsy();
        });

        it('should pass if every published subProgram has at least one step', () => {
          const doesEveryPublishedProgramHaveStep = subProgramList.every(sp => sp.status === DRAFT || sp.steps.length);

          expect(doesEveryPublishedProgramHaveStep).toBeTruthy();
        });

        it('should pass if every published subProgram has published steps', () => {
          const doesEveryPublishedProgramHavePublishedStep = subProgramList
            .every(sp => sp.status === DRAFT || sp.steps.every(step => step.status === PUBLISHED));

          expect(doesEveryPublishedProgramHavePublishedStep).toBeTruthy();
        });
      });

      describe('Collection TrainerMission', () => {
        let trainerMissionList;
        before(async () => {
          trainerMissionList = await TrainerMission
            .find()
            .populate({
              path: 'trainer',
              select: 'role',
              populate: [{ path: 'role.vendor', select: 'name' }],
              transform,
            })
            .populate({
              path: 'createdBy',
              select: 'role',
              populate: [{ path: 'role.vendor', select: 'name' }],
              transform,
            })
            .populate({ path: 'courses', select: 'trainers', transform })
            .setOptions({ isVendorUser: true })
            .lean();
        });

        it('should pass if every trainer exists and has good role', () => {
          const doesTrainerExistWithGoodRole = trainerMissionList
            .map(tm => tm.trainer).every(trainer => has(trainer, 'role.vendor'));
          expect(doesTrainerExistWithGoodRole).toBeTruthy();
        });

        it('should pass if every trainer is course trainer', () => {
          const hasEveryCourseGoodTrainer = trainerMissionList
            .every(tm => tm.courses
              .every(course =>
                !course.trainers.length || UtilsHelper.doesArrayIncludeId(course.trainers, tm.trainer._id))
            );

          expect(hasEveryCourseGoodTrainer).toBeTruthy();
        });

        it('should pass if every creator exists and has good role', () => {
          const doesCreatorExistWithGoodRole = trainerMissionList
            .map(tm => tm.createdBy)
            .every(creator => [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(creator.role.vendor.name));
          expect(doesCreatorExistWithGoodRole).toBeTruthy();
        });

        it('should pass if none course is in several trainer missions', () => {
          const coursesInMission = trainerMissionList
            .map(tm => tm.courses.map(course => course._id.toHexString())).flat();

          expect(coursesInMission.length).toBe([...new Set(coursesInMission)].length);
        });

        it('should pass if cancellation date is after trainer mission\'s date', () => {
          const everyCancellationDateIsAfter = trainerMissionList
            .every(tm => !tm.cancelledAt || CompaniDate(tm.date).isBefore(tm.cancelledAt));

          expect(everyCancellationDateIsAfter).toBeTruthy();
        });
      });

      describe('Collection TrainingContract', () => {
        let trainingContractList;
        before(async () => {
          trainingContractList = await TrainingContract
            .find()
            .populate({ path: 'course', select: '_id companies', transform })
            .populate({ path: 'company', select: '_id', transform })
            .setOptions({ allCompanies: true })
            .lean();
        });

        it('should pass if every course exists', () => {
          const coursesExist = trainingContractList.map(tc => tc.course).every(course => !!course);
          expect(coursesExist).toBeTruthy();
        });

        it('should pass if every company exists', () => {
          const companiesExist = trainingContractList.map(tc => tc.company).every(company => !!company);
          expect(companiesExist).toBeTruthy();
        });

        it('should pass if every company is in course', () => {
          const companyIsInCourse = trainingContractList
            .every(tc => UtilsHelper.doesArrayIncludeId(tc.course.companies, tc.company._id));
          expect(companyIsInCourse).toBeTruthy();
        });

        it('should pass if no company has two training contracts for the same course', () => {
          const trainingContractsGroupedByCourse = groupBy(trainingContractList, 'course._id');
          const someCompaniesHaveSeveralTrainingContracts = Object.keys(trainingContractsGroupedByCourse)
            .some((courseId) => {
              const uniqueTrainingContractCompanies = [
                ...new Set(trainingContractsGroupedByCourse[courseId].map(tc => tc.company._id.toHexString())),
              ];
              return trainingContractsGroupedByCourse[courseId].length !== uniqueTrainingContractCompanies.length;
            });

          expect(someCompaniesHaveSeveralTrainingContracts).toBeFalsy();
        });
      });

      describe('Collection User', () => {
        let userList;
        before(async () => {
          userList = await User
            .find()
            .populate({ path: 'role.client', select: 'interface' })
            .populate({ path: 'role.vendor', select: 'interface' })
            .populate({ path: 'company' })
            .lean();
        });

        it('should pass if every user with client role has a company', () => {
          const doUsersWithClientRoleHaveCompany = userList.filter(u => get(u, 'role.client')).every(u => u.company);
          expect(doUsersWithClientRoleHaveCompany).toBeTruthy();
        });

        it('should pass if every user\'s role exists', () => {
          const isRoleNotFound = userList.filter(u => u.role).some(u =>
            (has(u, 'role.client') && !get(u, 'role.client._id')) ||
            (has(u, 'role.vendor') && !get(u, 'role.vendor._id'))
          );
          expect(isRoleNotFound).toBeFalsy();
        });

        it('should pass if every user\'s role is in good interface', () => {
          const doUsersHaveRoleInWrongInterface = userList.filter(u => u.role).some(u =>
            (u.role.client && u.role.client.interface !== CLIENT) ||
            (u.role.vendor && u.role.vendor.interface !== VENDOR)
          );
          expect(doUsersHaveRoleInWrongInterface).toBeFalsy();
        });

        it('should pass if every user has either firstMobileConnectionDate or loginCode or none of these', () => {
          const doUserHaveBothFirstMobileConnectionAndLoginCode = userList
            .some(u => u.firstMobileConnectionDate && u.loginCode);

          expect(doUserHaveBothFirstMobileConnectionAndLoginCode).toBeFalsy();
        });

        it('should pass if every user who has firstMobileConnectionDate also has firstMobileConnectionMode', () => {
          const everyUserWithFirstMobileConnectionDateAlsoHasMode = userList
            .filter(u => u.firstMobileConnectionDate)
            .every(u => u.firstMobileConnectionMode);

          expect(everyUserWithFirstMobileConnectionDateAlsoHasMode).toBeTruthy();
        });

        it('should pass if every user who has phone also has countryCode', () => {
          const everyUserWithPhoneAlsoHasCountryCode = userList
            .filter(u => get(u, 'contact.phone'))
            .every(u => get(u, 'contact.countryCode'));

          expect(everyUserWithPhoneAlsoHasCountryCode).toBeTruthy();

          const everyUserWithCountryCodeAlsoHasPhone = userList
            .filter(u => get(u, 'contact.countryCode'))
            .every(u => get(u, 'contact.phone'));

          expect(everyUserWithCountryCodeAlsoHasPhone).toBeTruthy();
        });
      });

      describe('Collection UserCompany', () => {
        let userCompanyList;
        before(async () => {
          userCompanyList = await UserCompany
            .find()
            .populate({ path: 'user', select: '_id' })
            .populate({ path: 'company', select: '_id' })
            .lean();
        });

        it('should pass if every company exists', () => {
          const companiesExist = userCompanyList.map(uc => uc.company).every(company => !!company);
          expect(companiesExist).toBeTruthy();
        });

        it('should pass if every user exists', () => {
          const usersExist = userCompanyList.map(uc => uc.user).every(user => !!user);
          expect(usersExist).toBeTruthy();
        });

        it('should pass if endDates are greater than startDates', () => {
          const areEndDatesAfterStartDates = userCompanyList
            .filter(uc => uc.endDate)
            .every(uc => CompaniDate(uc.endDate).isAfter(uc.startDate));
          expect(areEndDatesAfterStartDates).toBeTruthy();
        });

        it('should pass if no userCompany intersects with another and only last one has endDate', () => {
          const userCompaniesGroupedByUser = groupBy(userCompanyList, 'user._id');
          let hasIntersectionInUserCompanies = false;
          for (const specificUserCompanyList of Object.values(userCompaniesGroupedByUser)) {
            const userCompanyWithoutEndDate = specificUserCompanyList.filter(uc => !uc.endDate);
            expect(userCompanyWithoutEndDate.length).toBeLessThanOrEqual(1);

            const sortedUserCompanyList = [...specificUserCompanyList].sort(ascendingSort('startDate'));
            for (let i = 0; i < sortedUserCompanyList.length - 1; i++) {
              expect(sortedUserCompanyList[i].endDate).toBeTruthy();

              const hasIntersectionWithNextUserCompany = CompaniDate(sortedUserCompanyList[i].endDate)
                .isSameOrAfter(sortedUserCompanyList[i + 1].startDate);
              hasIntersectionInUserCompanies = hasIntersectionInUserCompanies && hasIntersectionWithNextUserCompany;
            }
          }
          expect(hasIntersectionInUserCompanies).toBeFalsy();
        });
      });

      describe('Collection UserHolding', () => {
        let userHoldingList;
        before(async () => {
          userHoldingList = await UserHolding
            .find()
            .populate({
              path: 'user',
              select: '_id role',
              populate: [
                { path: 'company' },
                { path: 'role.client', select: 'name' },
                { path: 'role.holding', select: 'name' },
              ],
            })
            .populate({ path: 'holding', select: '_id', populate: { path: 'companies' } })
            .lean();
        });

        it('should pass if every user exists', () => {
          const usersExist = userHoldingList.map(uh => uh.user).every(user => !!user);
          expect(usersExist).toBeTruthy();
        });

        it('should pass if every holding exists', () => {
          const holdingsExist = userHoldingList.map(uh => uh.holding).every(holding => !!holding);
          expect(holdingsExist).toBeTruthy();
        });

        it('should pass if every user is linked to a single holding', () => {
          const isUserLinkedToManyHoldings = userHoldingList
            .some(userHolding => userHoldingList
              .filter(uh => UtilsHelper.areObjectIdsEquals(userHolding.user._id, uh.user._id)).length > 1
            );
          expect(isUserLinkedToManyHoldings).toBeFalsy();
        });

        it('should pass if every user company is linked to holding', async () => {
          const isUserCompanyLinkedToHolding = userHoldingList
            .every(uh => UtilsHelper.doesArrayIncludeId(uh.holding.companies, uh.user.company));
          expect(isUserCompanyLinkedToHolding).toBeTruthy();
        });

        it('should pass if every user has holding and client role', () => {
          const everyUserHasGoodRoles = userHoldingList
            .every(u => [COACH, CLIENT_ADMIN].includes(get(u.user, 'role.client.name')) &&
              get(u.user, 'role.holding.name') === HOLDING_ADMIN);

          expect(everyUserHasGoodRoles).toBeTruthy();
        });
      });

      describe('Collection VendorCompany', () => {
        let vendorCompanyList;
        before(async () => {
          vendorCompanyList = await VendorCompany
            .find()
            .populate({ path: 'billingRepresentative', populate: { path: 'role.vendor', select: 'name' } })
            .lean();
        });

        it('should pass if every billingRepresentative exists and has good role', () => {
          const doesEveryUserExistAndHasGoodRole = vendorCompanyList
            .every(vendorCompany => !has(vendorCompany, 'billingRepresentative') ||
              [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER]
                .includes(get(vendorCompany.billingRepresentative, 'role.vendor.name')));
          expect(doesEveryUserExistAndHasGoodRole).toBeTruthy();
        });
      });
    });
  });
});
