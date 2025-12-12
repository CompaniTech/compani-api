const Boom = require('@hapi/boom');
const get = require('lodash/get');
const {
  SERVICE,
  AUXILIARY,
  HELPER,
  CUSTOMER,
  FUNDING,
  SUBSCRIPTION,
  WORKING_EVENT,
  BILL,
  PAYMENT,
  ABSENCE,
  PAY,
  CONTRACT,
  SECTOR,
  RUP,
  REFERENT,
  COURSE,
  COURSE_SLOT,
  TRANSPORT,
  END_OF_COURSE,
  COURSE_BILL,
  COURSE_PAYMENT,
  SELF_POSITIONNING,
  SINGLE_COURSE,
  SINGLE,
  SINGLE_COURSE_SLOT,
  INTRA,
  INTRA_HOLDING,
  INTER_B2B,
} = require('../helpers/constants');
const { CompaniDate } = require('../helpers/dates/companiDates');
const HistoryExportHelper = require('../helpers/historyExport');
const VendorHistoryExportHelper = require('../helpers/vendorHistoryExport');
const DataExportHelper = require('../helpers/dataExport');
const { exportToCsv } = require('../helpers/file');

const exportData = async (req, h) => {
  try {
    req.log('exportController - exportData - params', req.params);
    req.log('exportController - exportData - company', get(req, 'auth.credentials.company._id'));

    const { type } = req.params;
    const { credentials } = req.auth;

    let data;
    switch (type) {
      case AUXILIARY:
        data = await DataExportHelper.exportAuxiliaries(credentials);
        break;
      case HELPER:
        data = await DataExportHelper.exportHelpers(credentials);
        break;
      case FUNDING:
        data = await DataExportHelper.exportFundings(credentials);
        break;
      case CUSTOMER:
        data = await DataExportHelper.exportCustomers(credentials);
        break;
      case SUBSCRIPTION:
        data = await DataExportHelper.exportSubscriptions(credentials);
        break;
      case SERVICE:
        data = await DataExportHelper.exportServices(credentials);
        break;
      case SECTOR:
        data = await DataExportHelper.exportSectors(credentials);
        break;
      case RUP:
        data = await DataExportHelper.exportStaffRegister(credentials);
        break;
      case REFERENT:
        data = await DataExportHelper.exportReferents(credentials);
        break;
    }

    const csv = await exportToCsv(data);

    return h.file(csv, { confine: false });
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const exportHistory = async (req, h) => {
  try {
    req.log('exportController - exportHistory - query', req.query);
    req.log('exportController - exportHistory - params', req.params);
    req.log('exportController - exportHistory - company', get(req, 'auth.credentials.company._id'));

    const { type } = req.params;
    const { credentials } = req.auth;

    const startDate = CompaniDate(req.query.startDate).startOf('day').toDate();
    const endDate = CompaniDate(req.query.endDate).endOf('day').toDate();

    let exportArray;
    switch (type) {
      case WORKING_EVENT:
        exportArray = await HistoryExportHelper.exportWorkingEventsHistory(startDate, endDate, credentials);
        break;
      case BILL:
        exportArray = await HistoryExportHelper.exportBillsAndCreditNotesHistory(startDate, endDate, credentials);
        break;
      case PAYMENT:
        exportArray = await HistoryExportHelper.exportPaymentsHistory(startDate, endDate, credentials);
        break;
      case ABSENCE:
        exportArray = await HistoryExportHelper.exportAbsencesHistory(startDate, endDate, credentials);
        break;
      case PAY:
        exportArray = await HistoryExportHelper.exportPayAndFinalPayHistory(startDate, endDate, credentials);
        break;
      case CONTRACT:
        exportArray = await HistoryExportHelper.exportContractHistory(startDate, endDate, credentials);
        break;
      case COURSE:
        exportArray = await VendorHistoryExportHelper
          .exportCourseHistory(startDate, endDate, credentials, [INTRA, INTRA_HOLDING, INTER_B2B]);
        break;
      case SINGLE_COURSE:
        exportArray = await VendorHistoryExportHelper.exportCourseHistory(startDate, endDate, credentials, [SINGLE]);
        break;
      case COURSE_SLOT:
        exportArray = await VendorHistoryExportHelper
          .exportCourseSlotHistory(startDate, endDate, credentials, [INTRA, INTRA_HOLDING, INTER_B2B]);
        break;
      case SINGLE_COURSE_SLOT:
        exportArray = await VendorHistoryExportHelper
          .exportCourseSlotHistory(startDate, endDate, credentials, [SINGLE]);
        break;
      case TRANSPORT:
        exportArray = await HistoryExportHelper.exportTransportsHistory(startDate, endDate, credentials);
        break;
      case END_OF_COURSE:
        exportArray = await VendorHistoryExportHelper
          .exportEndOfCourseQuestionnaireHistory(startDate, endDate, credentials);
        break;
      case COURSE_BILL:
        exportArray =
          await VendorHistoryExportHelper.exportCourseBillAndCreditNoteHistory(startDate, endDate, credentials);
        break;
      case COURSE_PAYMENT:
        exportArray = await VendorHistoryExportHelper.exportCoursePaymentHistory(startDate, endDate, credentials);
        break;
      case SELF_POSITIONNING:
        exportArray = await VendorHistoryExportHelper
          .exportSelfPositionningQuestionnaireHistory(startDate, endDate, credentials);
        break;
    }

    const csv = await exportToCsv(exportArray);

    return h.file(csv, { confine: false });
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { exportData, exportHistory };
