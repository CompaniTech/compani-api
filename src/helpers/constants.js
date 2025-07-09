module.exports = {
  // ENV
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
  TEST: 'test',
  // COLOR
  COPPER_50: '#F0FAF7',
  COPPER_100: '#DAF2EE',
  COPPER_500: '#1D7C8F',
  COPPER_600: '#005774',
  COPPER_GREY_200: '#E2ECF0',
  PEACH_100: '#FFEDDA',
  ORANGE_500: '#ED8936',
  ORANGE_600: '#DD6B20',
  SENDER_MAIL: 'nepasrepondre@compani.fr',
  REJECTED: 'rejected',
  // Time
  SECONDS_IN_AN_HOUR: 3600,
  // COMPANIDURATION
  PT0S: 'PT0S',
  // COMPANIDURATION FORMATS
  LONG_DURATION_H_MM: 'h\'h\' mm\'min\'',
  SHORT_DURATION_H_MM: 'h\'h\'mm',
  // COMPANIDATE FORMATS
  HHhMM: 'HH\'h\'mm',
  DD_MM_YYYY: 'dd/LL/yyyy',
  DAY_MONTH_YEAR: 'DDD',
  HH_MM: 'T',
  HH_MM_SS: 'HH:mm:ss',
  UPLOAD_DATE_FORMAT: 'yyyyLLddHHmmss',
  MM_YYYY: 'LL-yyyy',
  DAY_D_MONTH_YEAR: 'ccc d LLL yyyy',
  MONTH_YEAR: 'LLLL yyyy',
  // DATE INDEX
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
  CARE_HOLIDAY: 7,
  // DATE AND DURATION UNITS
  YEAR: 'year',
  QUARTER: 'quarter',
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  HOUR: 'hour',
  MINUTE: 'minute',
  SECOND: 'second',
  MILLISECOND: 'millisecond',
  // DURATION
  get DURATION_UNITS() {
    return [
      'years',
      'quarters',
      'months',
      'weeks',
      'days',
      'hours',
      'minutes',
      'seconds',
      'milliseconds',
    ];
  },
  // EVENTS
  INTERVENTION: 'intervention',
  ABSENCE: 'absence',
  HALF_DAILY: 'half_daily',
  UNAVAILABILITY: 'unavailability',
  UNJUSTIFIED: 'unjustified_absence',
  INTERNAL_HOUR: 'internal_hour',
  ILLNESS: 'illness',
  PAID_LEAVE: 'leave',
  UNPAID_LEAVE: 'unpaid_leave',
  MATERNITY_LEAVE: 'maternity_leave',
  PATERNITY_LEAVE: 'paternity_leave',
  PARENTAL_LEAVE: 'parental_leave',
  WORK_ACCIDENT: 'work_accident',
  TRANSPORT_ACCIDENT: 'transport_accident',
  CESSATION_OF_WORK_CHILD: 'cessation_of_work_child',
  CESSATION_OF_WORK_RISK: 'cessation_of_work_risk',
  get EVENT_TYPE_LIST() {
    return {
      [this.INTERNAL_HOUR]: 'Heure interne',
      [this.INTERVENTION]: 'Intervention',
      [this.ABSENCE]: 'Absence',
      [this.UNAVAILABILITY]: 'Indisponibilité',
    };
  },
  get ABSENCE_TYPE_LIST() {
    return {
      [this.PAID_LEAVE]: 'Congé',
      [this.UNPAID_LEAVE]: 'Congé sans solde',
      [this.MATERNITY_LEAVE]: 'Congé maternité',
      [this.PATERNITY_LEAVE]: 'Congé paternité',
      [this.PARENTAL_LEAVE]: 'Congé parental',
      [this.ILLNESS]: 'Maladie',
      [this.UNJUSTIFIED]: 'Absence injustifiée',
      [this.WORK_ACCIDENT]: 'Accident du travail',
      [this.TRANSPORT_ACCIDENT]: 'Accident de trajet',
      [this.CESSATION_OF_WORK_CHILD]: 'Arrêt de travail - garde d’enfant',
      [this.CESSATION_OF_WORK_RISK]: 'Arrêt de travail - salarié à risque',
      [this.OTHER]: 'other',
    };
  },
  get ABSENCE_NATURE_LIST() {
    return {
      [this.HOURLY]: 'Horaire',
      [this.DAILY]: 'Journalière',
      [this.HALF_DAILY]: 'Demi-journalière',
    };
  },
  PLANNING_VIEW_END_HOUR: 22,
  // COMPANY
  MAX_INTERNAL_HOURS_NUMBER: 9,
  COMPANY: 'company',
  ASSOCIATION: 'association',
  // COMPANY THIRD PARTY PAYERS
  BILLING_INDIRECT: 'indirect',
  BILLING_DIRECT: 'direct',
  APA: 'APA',
  AM: 'AM',
  PCH: 'PCH',
  // CUSTOMER
  MISTER: 'mr',
  MRS: 'mrs',
  COUPLE: 'couple',
  get CIVILITY_LIST() {
    return {
      [this.MISTER]: 'M.',
      [this.MRS]: 'Mme',
      [this.COUPLE]: 'Mme et M.',
    };
  },
  // CUSTOMER ABSENCE
  LEAVE: 'leave',
  // CUSTOMER FUNDINGS
  ONCE: 'once',
  HOURLY: 'hourly',
  FIXED: 'fixed',
  DAILY: 'daily',
  get FUNDING_NATURES() {
    return [
      { label: 'Forfaitaire', value: this.FIXED },
      { label: 'Horaire', value: this.HOURLY },
    ];
  },
  get FUNDING_FREQUENCIES() {
    return [
      { value: this.MONTHLY, label: 'Mensuelle' },
      { value: this.ONCE, label: 'Une seule fois' },
    ];
  },
  // CUSTOMER SITUATION
  UNKNOWN: 'unknown',
  HOME: 'home',
  NURSING_HOME: 'nursing_home',
  HOSPITALIZED: 'hospitalized',
  DECEASED: 'deceased',
  get CUSTOMER_SITUATIONS() {
    return [
      { label: 'Non renseigné', value: this.UNKNOWN },
      { label: 'Domicile', value: this.HOME },
      { label: 'EHPAD', value: this.NURSING_HOME },
      { label: 'Hospitalisé', value: this.HOSPITALIZED },
      { label: 'Décédé', value: this.DECEASED },
    ];
  },
  // REPETITION FREQUENCY
  FORCAST_PERIOD_FOR_CREATING_EVENTS: { days: 90 },
  NEVER: 'never',
  EVERY_DAY: 'every_day',
  EVERY_WEEK_DAY: 'every_week_day',
  EVERY_WEEK: 'every_week',
  EVERY_TWO_WEEKS: 'every_two_weeks',
  get REPETITION_FREQUENCY_TYPE_LIST() {
    return {
      [this.NEVER]: 'Jamais',
      [this.EVERY_DAY]: 'Tous les jours',
      [this.EVERY_WEEK_DAY]: 'Du lundi au vendredi',
      [this.EVERY_WEEK]: 'Une fois par semaine',
      [this.EVERY_TWO_WEEKS]: 'Toutes les deux semaines',
    };
  },
  TWO_WEEKS: 'two_weeks',
  get FIELDS_NOT_APPLICABLE_TO_REPETITION() {
    return ['misc', 'kmDuringEvent', 'transportMode', 'cancel', 'isCancelled'];
  },
  // PAYMENT
  PAYMENT: 'payment',
  REFUND: 'refund',
  DIRECT_DEBIT: 'direct_debit',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  CESU: 'cesu',
  CASH: 'cash',
  get PAYMENT_TYPES_LIST() {
    return {
      [this.DIRECT_DEBIT]: 'Prélèvement',
      [this.BANK_TRANSFER]: 'Virement',
      [this.CHECK]: 'Chèque',
      [this.CESU]: 'Cesu',
      [this.CASH]: 'Espèces',
    };
  },
  get PAYMENT_NATURE_LIST() {
    return {
      [this.PAYMENT]: 'Paiement',
      [this.REFUND]: 'Remboursement',
    };
  },
  // SURCHARGES
  PUBLIC_HOLIDAY: 'publicHoliday',
  TWENTY_FIFTH_OF_DECEMBER: 'twentyFifthOfDecember',
  FIRST_OF_MAY: 'firstOfMay',
  FIRST_OF_JANUARY: 'firstOfJanuary',
  EVENING: 'evening',
  CUSTOM: 'custom',
  SATURDAY_LETTER: 'saturday',
  SUNDAY_LETTER: 'sunday',
  get SURCHARGES() {
    return {
      [this.SATURDAY_LETTER]: 'Samedi',
      [this.SUNDAY_LETTER]: 'Dimanche',
      [this.PUBLIC_HOLIDAY]: 'Jours fériés',
      [this.TWENTY_FIFTH_OF_DECEMBER]: '25 Décembre',
      [this.FIRST_OF_MAY]: '1er Mai',
      [this.FIRST_OF_JANUARY]: '1er Janvier',
      [this.EVENING]: 'Soirée',
      [this.CUSTOM]: 'Personnalisée',
    };
  },
  // CANCELLATION OPTIONS
  INVOICED_AND_PAID: 'invoiced_and_paid',
  INVOICED_AND_NOT_PAID: 'invoiced_and_not_paid',
  NOT_INVOICED_AND_NOT_PAID: 'not_invoiced_and_not_paid',
  CUSTOMER_INITIATIVE: 'customer_initiative',
  AUXILIARY_INITIATIVE: 'auxiliary_initiative',
  get CANCELLATION_CONDITION_LIST() {
    return {
      [this.INVOICED_AND_PAID]: 'Facturée & payée',
      [this.INVOICED_AND_NOT_PAID]: 'Facturée & non payée',
      [this.NOT_INVOICED_AND_NOT_PAID]: 'Non facturée & non payée',
    };
  },
  get CANCELLATION_REASON_LIST() {
    return {
      [this.CUSTOMER_INITIATIVE]: 'Initiative du/de la client(e)',
      [this.AUXILIARY_INITIATIVE]: 'Initiative de l\'intervenant(e)',
    };
  },
  // INTERFACES
  CLIENT: 'client',
  VENDOR: 'vendor',
  HOLDING: 'holding',
  // ROLE CLIENT
  AUXILIARY: 'auxiliary',
  HELPER: 'helper',
  COACH: 'coach',
  PLANNING_REFERENT: 'planning_referent',
  AUXILIARY_WITHOUT_COMPANY: 'auxiliary_without_company',
  CLIENT_ADMIN: 'client_admin',
  get AUXILIARY_ROLES() { return [this.AUXILIARY, this.PLANNING_REFERENT, this.AUXILIARY_WITHOUT_COMPANY]; },
  get VENDOR_ROLES() { return [this.VENDOR_ADMIN, this.TRAINING_ORGANISATION_MANAGER, this.TRAINER]; },
  // ROLE VENDOR
  VENDOR_ADMIN: 'vendor_admin',
  TRAINING_ORGANISATION_MANAGER: 'training_organisation_manager',
  TRAINER: 'trainer',
  // ROLE HOLDING
  HOLDING_ADMIN: 'holding_admin',
  // APP NAMES
  FORMATION: 'formation',
  // SUBSCRIPTIONS
  ERP: 'erp',
  // BILLING
  BILL: 'bill',
  CREDIT_NOTE: 'credit_note',
  get BILLING_DOCUMENTS() {
    return {
      [this.BILL]: 'Facture',
      [this.CREDIT_NOTE]: 'Avoir',
    };
  },
  AUTOMATIC: 'automatic',
  ROUNDING_ERROR: 0.01,
  // SERVICE
  get SERVICE_NATURES() {
    return this.FUNDING_NATURES;
  },
  // BILING ITEMS
  MANUAL: 'manual',
  PER_INTERVENTION: 'per_intervention',
  // TRANSPORT
  PUBLIC_TRANSPORT: 'public',
  PRIVATE_TRANSPORT: 'private',
  COMPANY_TRANSPORT: 'company_transport',
  TRANSIT: 'transit',
  WALKING: 'walking',
  DRIVING: 'driving',
  NONE: 'none',
  get EVENT_TRANSPORT_MODE_LIST() {
    return {
      [this.PUBLIC_TRANSPORT]: 'Transports en commun / À pied',
      [this.PRIVATE_TRANSPORT]: 'Véhicule personnel',
      [this.COMPANY_TRANSPORT]: 'Véhicule d\'entreprise',
      [this.NONE]: 'Aucun',
    };
  },
  // PAY
  PAY: 'pay',
  get WORKING_DAYS() { return [this.MONDAY, this.TUESDAY, this.WEDNESDAY, this.THURSDAY, this.FRIDAY, this.SATURDAY]; },
  // CONTRACTS
  CONTRACT: 'contract',
  EMPLOYER_TRIAL_PERIOD_TERMINATION: 'employer_trial_period_termination',
  EMPLOYEE_TRIAL_PERIOD_TERMINATION: 'employee_trial_period_termination',
  RESIGNATION: 'resignation',
  SERIOUS_MISCONDUCT_LAYOFF: 'serious_misconduct_layoff',
  GROSS_FAULT_LAYOFF: 'gross_fault_layoff',
  OTHER_REASON_LAYOFF: 'other_reason_layoff',
  MUTATION: 'mutation',
  CONTRACTUAL_TERMINATION: 'contractual_termination',
  INTERNSHIP_END: 'internship_end',
  CDD_END: 'cdd_end',
  OTHER: 'other',
  get END_CONTRACT_REASONS() {
    return {
      [this.EMPLOYER_TRIAL_PERIOD_TERMINATION]: 'Rupture période d’essai employeur',
      [this.EMPLOYEE_TRIAL_PERIOD_TERMINATION]: 'Rupture période d’essai salarié',
      [this.RESIGNATION]: 'Démission',
      [this.SERIOUS_MISCONDUCT_LAYOFF]: 'Licenciement faute grave',
      [this.GROSS_FAULT_LAYOFF]: 'Licenciement faute lourde',
      [this.OTHER_REASON_LAYOFF]: 'Licenciement autre motif',
      [this.MUTATION]: 'Mutation',
      [this.CONTRACTUAL_TERMINATION]: 'Rupture conventionnelle',
      [this.INTERNSHIP_END]: 'Fin de stage',
      [this.CDD_END]: 'Fin de contrat CDD',
      [this.OTHER]: 'Autres',
    };
  },
  // ORIGINS
  COMPANI: 'compani',
  THIRD_PARTY: 'third_party',
  OGUST: 'ogust',
  WEEKS_PER_MONTH: (52 / 12),
  // EVENT HISTORY
  EVENT_CREATION: 'event_creation',
  EVENT_DELETION: 'event_deletion',
  EVENT_UPDATE: 'event_update',
  // PAY DOCUMENT NATURE
  PAYSLIP: 'payslip',
  CERTIFICATE: 'certificate',
  get PAY_DOCUMENT_NATURES() {
    return {
      [this.PAYSLIP]: 'Bulletin de paie',
      [this.CERTIFICATE]: 'Attestation',
      [this.OTHER]: 'Document paie',
    };
  },
  // COURSES
  INTRA: 'intra',
  INTER_B2B: 'inter_b2b',
  INTER_B2C: 'inter_b2c',
  INTRA_HOLDING: 'intra_holding',
  SINGLE: 'single',
  get COURSE_TYPES() {
    return {
      [this.INTRA]: 'Intra',
      [this.INTRA_HOLDING]: 'Intra société mère',
      [this.INTER_B2B]: 'Inter B2B',
      [this.SINGLE]: 'Individuelle',
    };
  },
  BLENDED: 'blended',
  STRICTLY_E_LEARNING: 'strictly_e_learning',
  CONVOCATION: 'convocation',
  REMINDER: 'reminder',
  OPERATIONS: 'operations',
  PEDAGOGY: 'pedagogy',
  // PROGRAMS
  DRAFT: 'draft',
  PUBLISHED: 'published',
  // STEP
  E_LEARNING: 'e_learning',
  ON_SITE: 'on_site',
  REMOTE: 'remote',
  get LIVE_STEPS() {
    return [this.ON_SITE, this.REMOTE];
  },
  get STEP_TYPES() {
    return {
      [this.E_LEARNING]: 'eLearning',
      [this.ON_SITE]: 'présentiel',
      [this.REMOTE]: 'distanciel',
    };
  },
  // ACTIVITY
  LESSON: 'lesson',
  QUIZ: 'quiz',
  SHARING_EXPERIENCE: 'sharing_experience',
  VIDEO: 'video',
  // CARD CATEGORIES
  QUESTIONNAIRE: 'questionnaire',
  // E-LEARNING CARDS
  TRANSITION: 'transition',
  TITLE_TEXT_MEDIA: 'title_text_media',
  TITLE_TEXT: 'title_text',
  TEXT_MEDIA: 'text_media',
  FLASHCARD: 'flashcard',
  FILL_THE_GAPS: 'fill_the_gaps',
  MULTIPLE_CHOICE_QUESTION: 'multiple_choice_question',
  SINGLE_CHOICE_QUESTION: 'single_choice_question',
  ORDER_THE_SEQUENCE: 'order_the_sequence',
  OPEN_QUESTION: 'open_question',
  SURVEY: 'survey',
  QUESTION_ANSWER: 'question_answer',
  FILL_THE_GAPS_MIN_ANSWERS_COUNT: 3,
  FILL_THE_GAPS_MAX_ANSWERS_COUNT: 8,
  FILL_THE_GAPS_MAX_GAPS_COUNT: 2,
  CHOICE_QUESTION_MAX_ANSWERS_COUNT: 4,
  CHOICE_QUESTION_MIN_ANSWERS_COUNT: 2,
  ORDER_THE_SEQUENCE_ANSWERS_COUNT: 3,
  QUESTION_ANSWER_MAX_ANSWERS_COUNT: 4,
  QUESTION_ANSWER_MIN_ANSWERS_COUNT: 2,
  QC_ANSWER_MAX_LENGTH: 70,
  QUESTION_MAX_LENGTH: 170,
  GAP_ANSWER_MAX_LENGTH: 15,
  FLASHCARD_TEXT_MAX_LENGTH: 450,
  get CARD_TEMPLATES() {
    return [
      { label: 'Transition', value: this.TRANSITION, type: this.LESSON },
      { label: 'Titre Texte Média', value: this.TITLE_TEXT_MEDIA, type: this.LESSON },
      { label: 'Titre Texte', value: this.TITLE_TEXT, type: this.LESSON },
      { label: 'Texte Média', value: this.TEXT_MEDIA, type: this.LESSON },
      { label: 'Flashcard', value: this.FLASHCARD, type: this.LESSON },
      { label: 'Texte à trou', value: this.FILL_THE_GAPS, type: this.QUIZ },
      { label: 'QCM', value: this.MULTIPLE_CHOICE_QUESTION, type: this.QUIZ },
      { label: 'QCU', value: this.SINGLE_CHOICE_QUESTION, type: this.QUIZ },
      { label: 'Mettre dans l\'ordre', value: this.ORDER_THE_SEQUENCE, type: this.QUIZ },
      { label: 'Question ouverte', value: this.OPEN_QUESTION, type: this.QUESTIONNAIRE },
      { label: 'Sondage', value: this.SURVEY, type: this.QUESTIONNAIRE },
      { label: 'Question\t&\tRéponse', value: this.QUESTION_ANSWER, type: this.QUESTIONNAIRE },
    ];
  },
  // QUESTIONNAIRE
  EXPECTATIONS: 'expectations',
  END_OF_COURSE: 'end_of_course',
  SELF_POSITIONNING: 'self_positionning',
  REVIEW: 'review',
  // QUESTIONNAIRE_HISTORY
  START_COURSE: 'start_course',
  END_COURSE: 'end_course',
  get TIMELINE_OPTIONS() { return [this.START_COURSE, this.END_COURSE, this.UNKNOWN]; },
  // COURSE TIMELINE
  BEFORE_MIDDLE_COURSE_END_DATE: 'before_middle_course_end_date',
  BETWEEN_MID_AND_END_COURSE: 'between_mid_and_end_course',
  ENDED: 'ended',
  // tests end2end
  PLANNING: 'planning',
  AUTHENTICATION: 'authentication',
  BILLING: 'billing',
  // CourseHistory
  SLOT_CREATION: 'slot_creation',
  SLOT_DELETION: 'slot_deletion',
  SLOT_EDITION: 'slot_edition',
  TRAINEE_ADDITION: 'trainee_addition',
  TRAINEE_DELETION: 'trainee_deletion',
  ESTIMATED_START_DATE_EDITION: 'estimated_start_date_edition',
  COMPANY_ADDITION: 'company_addition',
  COMPANY_DELETION: 'company_deletion',
  TRAINER_ADDITION: 'trainer_addition',
  TRAINER_DELETION: 'trainer_deletion',
  COURSE_INTERRUPTION: 'course_interruption',
  COURSE_RESTART: 'course_restart',
  // MediaUpload
  UPLOAD_IMAGE: 'image',
  UPLOAD_VIDEO: 'video',
  UPLOAD_AUDIO: 'audio',
  // ORIGIN
  MOBILE: 'mobile',
  WEBAPP: 'webapp',
  get ORIGIN_OPTIONS() { return [this.WEBAPP, this.MOBILE]; },
  // FORMAT
  PDF: 'pdf',
  ALL_WORD: 'all_word',
  ALL_PDF: 'all_pdf',
  get FORMAT_OPTIONS() { return [this.PDF, this.ALL_PDF, this.ALL_WORD]; },
  // TYPE (COMPLETION CERTIFICATES)
  OFFICIAL: 'official',
  get TYPE_OPTIONS() { return [this.OFFICIAL, this.CUSTOM]; },
  // Email
  TRAINEE: 'trainee',
  // Type
  EMAIL: 'email',
  PHONE: 'phone',
  // PARTNER
  SOCIAL_WORKER: 'social_worker',
  MEDICO_SOCIAL_ASSESSOR: 'medico_social_assessor',
  DOCTOR: 'doctor',
  GERIATRICIAN: 'geriatrician',
  COORDINATOR: 'coordinator',
  DIRECTOR: 'director',
  CASE_MANAGER: 'case_manager',
  NURSE: 'nurse',
  PSYCHOLOGIST: 'psychologist',
  get JOBS() {
    return [
      this.SOCIAL_WORKER,
      this.MEDICO_SOCIAL_ASSESSOR,
      this.DOCTOR,
      this.GERIATRICIAN,
      this.COORDINATOR,
      this.DIRECTOR,
      this.CASE_MANAGER,
      this.NURSE,
      this.PSYCHOLOGIST,
    ];
  },
  // NOTIFICATION
  BLENDED_COURSE_REGISTRATION: 'blended_course_registration',
  NEW_ELEARNING_COURSE: 'new_elearning_course',
  ATTENDANCE_SHEET_SIGNATURE_REQUEST: 'attendance_sheet_signature_request',
  // TIMESTAMP
  MANUAL_TIME_STAMPING: 'manual_time_stamping',
  QR_CODE_TIME_STAMPING: 'qr_code_time_stamping',
  get TIMESTAMPING_ACTION_TYPE_LIST() {
    return {
      [this.MANUAL_TIME_STAMPING]: 'Manuel',
      [this.QR_CODE_TIME_STAMPING]: 'QR Code',
    };
  },
  get TIME_STAMPING_ACTIONS() {
    return [this.MANUAL_TIME_STAMPING, this.QR_CODE_TIME_STAMPING];
  },
  QRCODE_MISSING: 'qrcode_missing',
  QRCODE_ERROR: 'qrcode_error',
  CAMERA_ERROR: 'camera_error',
  get MANUAL_TIME_STAMPING_REASONS() {
    return {
      [this.QRCODE_MISSING]: 'QR Code manquant',
      [this.QRCODE_ERROR]: 'Erreur de QR Code',
      [this.CAMERA_ERROR]: 'Problème de caméra',
    };
  },
  TIME_STAMP_CANCELLATION: 'time_stamp_cancellation',
  // STOP REASONS
  QUALITY: 'quality',
  HOSPITALIZATION: 'hospitalization',
  DEATH: 'death',
  EPHAD_DEPARTURE: 'ephad_departure',
  CONDITION_IMPROVEMENT: 'condition_improvement',
  // DOCUMENTS
  DOCUMENT_TYPE_LIST: [
    'contract',
    'contractVersion',
    'debitMandate',
    'quote',
    'gcs',
  ],
  // NOTES
  NOTE_CREATION: 'note_creation',
  NOTE_UPDATE: 'note_update',
  // STATUS
  ACTIVATED: 'Actif',
  STOPPED: 'Arrêté',
  ARCHIVED: 'Archivé',
  // EXPORTS
  SERVICE: 'service',
  SECTOR: 'sector',
  RUP: 'rup',
  REFERENT: 'referent',
  CUSTOMER: 'customer',
  SUBSCRIPTION: 'subscription',
  FUNDING: 'funding',
  get CARE_DAYS_INDEX() {
    return {
      [this.MONDAY]: 'Lundi',
      [this.TUESDAY]: 'Mardi',
      [this.WEDNESDAY]: 'Mercredi',
      [this.THURSDAY]: 'Jeudi',
      [this.FRIDAY]: 'Vendredi',
      [this.SATURDAY]: 'Samedi',
      [this.SUNDAY]: 'Dimanche',
      [this.CARE_HOLIDAY]: 'Jours fériés',
    };
  },
  // EXPORTS HISTORY
  NO_DATA: 'Aucune donnée sur la période sélectionnée',
  TRANSPORT: 'transport',
  WORKING_EVENT: 'working_event', // intervention or internal hours
  COURSE: 'course',
  COURSE_SLOT: 'course_slot',
  COURSE_BILL: 'course_bill',
  COURSE_PAYMENT: 'course_payment',
  get HISTORY_EXPORT_TYPES() {
    return [
      this.WORKING_EVENT,
      this.BILL,
      this.PAYMENT,
      this.ABSENCE,
      this.PAY,
      this.CONTRACT,
      this.COURSE,
      this.COURSE_SLOT,
      this.TRANSPORT,
      this.END_OF_COURSE,
      this.COURSE_BILL,
      this.COURSE_PAYMENT,
      this.SELF_POSITIONNING,
    ];
  },
  get CLIENT_EXPORT_TYPES() {
    return [
      this.WORKING_EVENT,
      this.BILL,
      this.PAYMENT,
      this.ABSENCE,
      this.PAY,
      this.CONTRACT,
      this.SERVICE,
      this.AUXILIARY,
      this.HELPER,
      this.CUSTOMER,
      this.FUNDING,
      this.SUBSCRIPTION,
      this.SECTOR,
      this.RUP,
      this.REFERENT,
      this.TRANSPORT,
    ];
  },
  get VENDOR_EXPORT_TYPES() {
    return [
      this.COURSE,
      this.COURSE_SLOT,
      this.END_OF_COURSE,
      this.COURSE_BILL,
      this.COURSE_PAYMENT,
      this.SELF_POSITIONNING,
    ];
  },
  // COURSE BILLING
  LIST: 'list',
  BALANCE: 'balance',
  DASHBOARD: 'dashboard',
  GROUP: 'group',
  get COUNT_UNIT() {
    return {
      [this.GROUP]: 'groupe',
      [this.TRAINEE]: 'stagiaire',
    };
  },
  // LEARNERS
  DIRECTORY: 'directory',
  // MOBILE CONNECTION
  ACCOUNT_CREATION: 'account_creation',
  LOGIN_CODE: 'login_code',
  IDENTITY_VERIFICATION: 'identity_verification',
  get MOBILE_CONNECTION_MODE() {
    return [this.ACCOUNT_CREATION, this.AUTHENTICATION, this.LOGIN_CODE, this.IDENTITY_VERIFICATION, this.UNKNOWN];
  },
  // TRAINER MISSION CREATION METHOD TYPES
  UPLOAD: 'upload',
  GENERATION: 'generation',
  get CREATION_METHOD_TYPES() { return [this.UPLOAD, this.GENERATION]; },
  // COMPLETION CERTIFICATE GENERATION MODE
  GLOBAL: 'global',
  MONTHLY: 'monthly',
};
