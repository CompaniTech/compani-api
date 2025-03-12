const Activity = require('../../../src/models/Activity');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const AdministrativeDocument = require('../../../src/models/AdministrativeDocument');
const Attendance = require('../../../src/models/Attendance');
const AttendanceSheet = require('../../../src/models/AttendanceSheet');
const Bill = require('../../../src/models/Bill');
const BillingItem = require('../../../src/models/BillingItem');
const BillNumber = require('../../../src/models/BillNumber');
const BillSlipNumber = require('../../../src/models/BillSlipNumber');
const BillSlip = require('../../../src/models/BillSlip');
const Card = require('../../../src/models/Card');
const Category = require('../../../src/models/Category');
const Company = require('../../../src/models/Company');
const CompanyHolding = require('../../../src/models/CompanyHolding');
const CompanyLinkRequest = require('../../../src/models/CompanyLinkRequest');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const ContractNumber = require('../../../src/models/ContractNumber');
const Contract = require('../../../src/models/Contract');
const CourseHistory = require('../../../src/models/CourseHistory');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillingItem = require('../../../src/models/CourseBillingItem');
const CourseCreditNote = require('../../../src/models/CourseCreditNote');
const CourseCreditNoteNumber = require('../../../src/models/CourseCreditNoteNumber');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const CourseFundingOrganisation = require('../../../src/models/CourseFundingOrganisation');
const CoursePayment = require('../../../src/models/CoursePayment');
const CoursePaymentNumber = require('../../../src/models/CoursePaymentNumber');
const CourseSlot = require('../../../src/models/CourseSlot');
const CourseSmsHistory = require('../../../src/models/CourseSmsHistory');
const CreditNoteNumber = require('../../../src/models/CreditNoteNumber');
const CreditNote = require('../../../src/models/CreditNote');
const CustomerAbsence = require('../../../src/models/CustomerAbsence');
const CustomerNoteHistory = require('../../../src/models/CustomerNoteHistory');
const CustomerNote = require('../../../src/models/CustomerNote');
const CustomerPartner = require('../../../src/models/CustomerPartner');
const Customer = require('../../../src/models/Customer');
const DistanceMatrix = require('../../../src/models/DistanceMatrix');
const Establishment = require('../../../src/models/Establishment');
const EventHistory = require('../../../src/models/EventHistory');
const Event = require('../../../src/models/Event');
const FinalPay = require('../../../src/models/FinalPay');
const FundingHistory = require('../../../src/models/FundingHistory');
const Helper = require('../../../src/models/Helper');
const Holding = require('../../../src/models/Holding');
const IdentityVerification = require('../../../src/models/IdentityVerification');
const InternalHour = require('../../../src/models/InternalHour');
const PartnerOrganization = require('../../../src/models/PartnerOrganization');
const Partner = require('../../../src/models/Partner');
const PayDocument = require('../../../src/models/PayDocument');
const PaymentNumber = require('../../../src/models/PaymentNumber');
const Payment = require('../../../src/models/Payment');
const Pay = require('../../../src/models/Pay');
const Program = require('../../../src/models/Program');
const QuestionnaireHistory = require('../../../src/models/QuestionnaireHistory');
const Questionnaire = require('../../../src/models/Questionnaire');
const QuoteNumber = require('../../../src/models/QuoteNumber');
const ReferentHistory = require('../../../src/models/ReferentHistory');
const Repetition = require('../../../src/models/Repetition');
const Role = require('../../../src/models/Role');
const Rum = require('../../../src/models/Rum');
const SectorHistory = require('../../../src/models/SectorHistory');
const Sector = require('../../../src/models/Sector');
const Service = require('../../../src/models/Service');
const Step = require('../../../src/models/Step');
const SubProgram = require('../../../src/models/SubProgram');
const Surcharge = require('../../../src/models/Surcharge');
const TaxCertificate = require('../../../src/models/TaxCertificate');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const TrainerMission = require('../../../src/models/TrainerMission');
const TrainingContract = require('../../../src/models/TrainingContract');
const UserCompany = require('../../../src/models/UserCompany');
const UserHolding = require('../../../src/models/UserHolding');
const User = require('../../../src/models/User');
const VendorCompany = require('../../../src/models/VendorCompany');
const { rolesList } = require('../../seed/authRolesSeed');
const { userList } = require('../../seed/authUsersSeed');
const {
  authCompany,
  otherCompany,
  companyWithoutSubscription,
  authHolding,
  otherHolding,
} = require('../../seed/authCompaniesSeed');
const { sector, sectorHistories } = require('../../seed/authSectorsSeed');
const { authCustomer, helperCustomer } = require('../../seed/authCustomers');

const deleteNonAuthenticationSeeds = async () => {
  await Promise.all([
    Activity.deleteMany(),
    ActivityHistory.deleteMany(),
    AdministrativeDocument.deleteMany(),
    Attendance.deleteMany(),
    AttendanceSheet.deleteMany(),
    Bill.deleteMany(),
    BillingItem.deleteMany(),
    BillNumber.deleteMany(),
    BillSlipNumber.deleteMany(),
    BillSlip.deleteMany(),
    Card.deleteMany(),
    Category.deleteMany(),
    Company.deleteMany({ _id: { $nin: [authCompany._id, otherCompany._id, companyWithoutSubscription._id] } }),
    CompanyHolding.deleteMany({
      company: { $nin: [authCompany._id, otherCompany._id, companyWithoutSubscription._id] },
    }),
    CompanyLinkRequest.deleteMany(),
    CompletionCertificate.deleteMany(),
    ContractNumber.deleteMany(),
    Contract.deleteMany(),
    CourseHistory.deleteMany(),
    Course.deleteMany(),
    CourseBill.deleteMany(),
    CourseBillingItem.deleteMany(),
    CourseBillsNumber.deleteMany(),
    CourseCreditNote.deleteMany(),
    CourseCreditNoteNumber.deleteMany(),
    CourseFundingOrganisation.deleteMany(),
    CoursePayment.deleteMany(),
    CoursePaymentNumber.deleteMany(),
    CourseSlot.deleteMany(),
    CourseSmsHistory.deleteMany(),
    CreditNoteNumber.deleteMany(),
    CreditNote.deleteMany(),
    CustomerAbsence.deleteMany(),
    CustomerNoteHistory.deleteMany(),
    CustomerNote.deleteMany(),
    CustomerPartner.deleteMany(),
    Customer.deleteMany({ _id: { $nin: [authCustomer._id] } }),
    DistanceMatrix.deleteMany(),
    Establishment.deleteMany(),
    EventHistory.deleteMany(),
    Event.deleteMany(),
    FinalPay.deleteMany(),
    FundingHistory.deleteMany(),
    Helper.deleteMany({ _id: { $nin: [helperCustomer._id] } }),
    Holding.deleteMany({ _id: { $nin: [authHolding._id, otherHolding._id] } }),
    IdentityVerification.deleteMany(),
    InternalHour.deleteMany(),
    PartnerOrganization.deleteMany(),
    Partner.deleteMany(),
    PayDocument.deleteMany(),
    PaymentNumber.deleteMany(),
    Payment.deleteMany(),
    Pay.deleteMany(),
    Program.deleteMany(),
    QuestionnaireHistory.deleteMany(),
    Questionnaire.deleteMany(),
    QuoteNumber.deleteMany(),
    ReferentHistory.deleteMany(),
    Repetition.deleteMany(),
    Role.deleteMany({ _id: { $nin: rolesList.map(role => role._id) } }),
    Rum.deleteMany(),
    SectorHistory.deleteMany({ _id: { $nin: sectorHistories.map(sectorHistory => sectorHistory._id) } }),
    Sector.deleteMany({ _id: { $nin: [sector._id] } }),
    Service.deleteMany(),
    Step.deleteMany(),
    SubProgram.deleteMany(),
    Surcharge.deleteMany(),
    TaxCertificate.deleteMany(),
    ThirdPartyPayer.deleteMany(),
    TrainerMission.deleteMany(),
    TrainingContract.deleteMany(),
    UserCompany.deleteMany({ user: { $nin: userList.map(user => user._id) } }),
    UserHolding.deleteMany({ user: { $nin: userList.map(user => user._id) } }),
    User.deleteMany({ _id: { $nin: userList.map(user => user._id) } }),
    VendorCompany.deleteMany(),
  ]);
};

module.exports = { deleteNonAuthenticationSeeds };
