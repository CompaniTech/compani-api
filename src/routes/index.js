exports.routes = [
  { plugin: require('./activities'), routes: { prefix: '/activities' } },
  { plugin: require('./activityHistories'), routes: { prefix: '/activityhistories' } },
  { plugin: require('./attendances'), routes: { prefix: '/attendances' } },
  { plugin: require('./attendanceSheets'), routes: { prefix: '/attendancesheets' } },
  { plugin: require('./authentication'), routes: { prefix: '/users' } },
  { plugin: require('./balances'), routes: { prefix: '/balances' } },
  { plugin: require('./bills'), routes: { prefix: '/bills' } },
  { plugin: require('./cards'), routes: { prefix: '/cards' } },
  { plugin: require('./categories'), routes: { prefix: '/categories' } },
  { plugin: require('./companies'), routes: { prefix: '/companies' } },
  { plugin: require('./companyLinkRequests'), routes: { prefix: '/companylinkrequests' } },
  { plugin: require('./courseBills'), routes: { prefix: '/coursebills' } },
  { plugin: require('./courseBillingItems'), routes: { prefix: '/coursebillingitems' } },
  { plugin: require('./courseCreditNotes'), routes: { prefix: '/coursecreditnotes' } },
  { plugin: require('./courseFundingOrganisations'), routes: { prefix: '/coursefundingorganisations' } },
  { plugin: require('./courseHistories'), routes: { prefix: '/coursehistories' } },
  { plugin: require('./coursePayments'), routes: { prefix: '/coursepayments' } },
  { plugin: require('./courses'), routes: { prefix: '/courses' } },
  { plugin: require('./courseSlots'), routes: { prefix: '/courseslots' } },
  { plugin: require('./creditNotes'), routes: { prefix: '/creditNotes' } },
  { plugin: require('./email'), routes: { prefix: '/email' } },
  { plugin: require('./endToEnd'), routes: { prefix: '/end-to-end' } },
  { plugin: require('./eventHistories'), routes: { prefix: '/eventhistories' } },
  { plugin: require('./events'), routes: { prefix: '/events' } },
  { plugin: require('./exports'), routes: { prefix: '/exports' } },
  { plugin: require('./helpers'), routes: { prefix: '/helpers' } },
  { plugin: require('./holdings'), routes: { prefix: '/holdings' } },
  { plugin: require('./payments'), routes: { prefix: '/payments' } },
  { plugin: require('./programs'), routes: { prefix: '/programs' } },
  { plugin: require('./questionnaireHistories'), routes: { prefix: '/questionnairehistories' } },
  { plugin: require('./questionnaires'), routes: { prefix: '/questionnaires' } },
  { plugin: require('./roles'), routes: { prefix: '/roles' } },
  { plugin: require('./steps'), routes: { prefix: '/steps' } },
  { plugin: require('./subPrograms'), routes: { prefix: '/subprograms' } },
  { plugin: require('./taxCertificates'), routes: { prefix: '/taxcertificates' } },
  { plugin: require('./trainerMissions'), routes: { prefix: '/trainermissions' } },
  { plugin: require('./trainingContracts'), routes: { prefix: '/trainingcontracts' } },
  { plugin: require('./users'), routes: { prefix: '/users' } },
  { plugin: require('./userCompanies'), routes: { prefix: '/usercompanies' } },
  { plugin: require('./vendorCompanies'), routes: { prefix: '/vendorcompanies' } },
  { plugin: require('./version'), routes: { prefix: '/version' } },
];
