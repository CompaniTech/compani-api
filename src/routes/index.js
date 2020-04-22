exports.routes = [
  {
    plugin: require('./users'),
    routes: { prefix: '/users' },
  },
  {
    plugin: require('./administrativeDocuments'),
    routes: { prefix: '/administrativedocuments' },
  },
  {
    plugin: require('./roles'),
    routes: { prefix: '/roles' },
  },
  {
    plugin: require('./email'),
    routes: { prefix: '/email' },
  },
  {
    plugin: require('./blog'),
    routes: { prefix: '/blog' },
  },
  {
    plugin: require('./Google/drive'),
    routes: { prefix: '/gdrive' },
  },
  {
    plugin: require('./cloudinary'),
    routes: { prefix: '/cloudinary' },
  },
  {
    plugin: require('./twilio'),
    routes: { prefix: '/sms' },
  },
  {
    plugin: require('./companies'),
    routes: { prefix: '/companies' },
  },
  {
    plugin: require('./customers'),
    routes: { prefix: '/customers' },
  },
  {
    plugin: require('./Esign'),
    routes: { prefix: '/esign' },
  },
  {
    plugin: require('./events'),
    routes: { prefix: '/events' },
  },
  {
    plugin: require('./sectors'),
    routes: { prefix: '/sectors' },
  },
  {
    plugin: require('./contracts'),
    routes: { prefix: '/contracts' },
  },
  {
    plugin: require('./services'),
    routes: { prefix: '/services' },
  },
  {
    plugin: require('./surcharges'),
    routes: { prefix: '/surcharges' },
  },
  {
    plugin: require('./thirdPartyPayers'),
    routes: { prefix: '/thirdpartypayers' },
  },
  {
    plugin: require('./bills'),
    routes: { prefix: '/bills' },
  },
  {
    plugin: require('./creditNotes'),
    routes: { prefix: '/creditNotes' },
  },
  {
    plugin: require('./balances'),
    routes: { prefix: '/balances' },
  },
  {
    plugin: require('./payments'),
    routes: { prefix: '/payments' },
  },
  {
    plugin: require('./exports'),
    routes: { prefix: '/exports' },
  },
  {
    plugin: require('./pay'),
    routes: { prefix: '/pay' },
  },
  {
    plugin: require('./finalPay'),
    routes: { prefix: '/finalpay' },
  },
  {
    plugin: require('./eventHistories'),
    routes: { prefix: '/eventhistories' },
  },
  {
    plugin: require('./payDocuments'),
    routes: { prefix: '/paydocuments' },
  },
  {
    plugin: require('./stats'),
    routes: { prefix: '/stats' },
  },
  {
    plugin: require('./internalHours'),
    routes: { prefix: '/internalhours' },
  },
  {
    plugin: require('./billSlips'),
    routes: { prefix: '/billslips' },
  },
  {
    plugin: require('./scripts'),
    routes: { prefix: '/scripts' },
  },
  {
    plugin: require('./taxCertificates'),
    routes: { prefix: '/taxcertificates' },
  },
  {
    plugin: require('./establishments'),
    routes: { prefix: '/establishments' },
  },
  {
    plugin: require('./programs'),
    routes: { prefix: '/programs' },
  },
  {
    plugin: require('./endToEnd'),
    routes: { prefix: '/end-to-end' },
  },
  {
    plugin: require('./courses'),
    routes: { prefix: '/courses' },
  },
  {
    plugin: require('./courseSlots'),
    routes: { prefix: '/courseslots' },
  },
];
