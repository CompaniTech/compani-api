exports.routes = [
  { plugin: require('./activities'), routes: { prefix: '/activities' } },
  { plugin: require('./activityHistories'), routes: { prefix: '/activityhistories' } },
  { plugin: require('./administrativeDocuments'), routes: { prefix: '/administrativedocuments' } },
  { plugin: require('./attendances'), routes: { prefix: '/attendances' } },
  { plugin: require('./attendanceSheets'), routes: { prefix: '/attendancesheets' } },
  { plugin: require('./authentication'), routes: { prefix: '/users' } },
  { plugin: require('./balances'), routes: { prefix: '/balances' } },
  { plugin: require('./billingItems'), routes: { prefix: '/billingitems' } },
  { plugin: require('./bills'), routes: { prefix: '/bills' } },
  { plugin: require('./billSlips'), routes: { prefix: '/billslips' } },
  { plugin: require('./blog'), routes: { prefix: '/blog' } },
  { plugin: require('./cards'), routes: { prefix: '/cards' } },
  { plugin: require('./categories'), routes: { prefix: '/categories' } },
  { plugin: require('./companies'), routes: { prefix: '/companies' } },
  { plugin: require('./companyLinkRequests'), routes: { prefix: '/companylinkrequests' } },
  { plugin: require('./contracts'), routes: { prefix: '/contracts' } },
  { plugin: require('./courseFundingOrganisations'), routes: { prefix: '/coursefundingorganisations' } },
  { plugin: require('./courseHistories'), routes: { prefix: '/coursehistories' } },
  { plugin: require('./courses'), routes: { prefix: '/courses' } },
  { plugin: require('./courseSlots'), routes: { prefix: '/courseslots' } },
  { plugin: require('./creditNotes'), routes: { prefix: '/creditNotes' } },
  { plugin: require('./customerAbsences'), routes: { prefix: '/customerabsences' } },
  { plugin: require('./customerNotes'), routes: { prefix: '/customernotes' } },
  { plugin: require('./customerPartners'), routes: { prefix: '/customerpartners' } },
  { plugin: require('./customers'), routes: { prefix: '/customers' } },
  { plugin: require('./email'), routes: { prefix: '/email' } },
  { plugin: require('./endToEnd'), routes: { prefix: '/end-to-end' } },
  { plugin: require('./Esign'), routes: { prefix: '/esign' } },
  { plugin: require('./establishments'), routes: { prefix: '/establishments' } },
  { plugin: require('./eventHistories'), routes: { prefix: '/eventhistories' } },
  { plugin: require('./events'), routes: { prefix: '/events' } },
  { plugin: require('./exports'), routes: { prefix: '/exports' } },
  { plugin: require('./finalPay'), routes: { prefix: '/finalpay' } },
  { plugin: require('./Google/drive'), routes: { prefix: '/gdrive' } },
  { plugin: require('./helpers'), routes: { prefix: '/helpers' } },
  { plugin: require('./internalHours'), routes: { prefix: '/internalhours' } },
  { plugin: require('./partnerOrganizations'), routes: { prefix: '/partnerorganizations' } },
  { plugin: require('./partners'), routes: { prefix: '/partners' } },
  { plugin: require('./pay'), routes: { prefix: '/pay' } },
  { plugin: require('./payDocuments'), routes: { prefix: '/paydocuments' } },
  { plugin: require('./payments'), routes: { prefix: '/payments' } },
  { plugin: require('./programs'), routes: { prefix: '/programs' } },
  { plugin: require('./questionnaireHistories'), routes: { prefix: '/questionnairehistories' } },
  { plugin: require('./questionnaires'), routes: { prefix: '/questionnaires' } },
  { plugin: require('./roles'), routes: { prefix: '/roles' } },
  { plugin: require('./scripts'), routes: { prefix: '/scripts' } },
  { plugin: require('./sectors'), routes: { prefix: '/sectors' } },
  { plugin: require('./services'), routes: { prefix: '/services' } },
  { plugin: require('./sms'), routes: { prefix: '/sms' } },
  { plugin: require('./stats'), routes: { prefix: '/stats' } },
  { plugin: require('./steps'), routes: { prefix: '/steps' } },
  { plugin: require('./subPrograms'), routes: { prefix: '/subprograms' } },
  { plugin: require('./surcharges'), routes: { prefix: '/surcharges' } },
  { plugin: require('./taxCertificates'), routes: { prefix: '/taxcertificates' } },
  { plugin: require('./teletransmission'), routes: { prefix: '/teletransmission' } },
  { plugin: require('./thirdPartyPayers'), routes: { prefix: '/thirdpartypayers' } },
  { plugin: require('./users'), routes: { prefix: '/users' } },
  { plugin: require('./version'), routes: { prefix: '/version' } },
];
