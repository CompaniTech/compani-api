const Boom = require('@hapi/boom');
const groupBy = require('lodash/groupBy');
const PendingCourseBill = require('../models/PendingCourseBill');
const CourseBill = require('../models/CourseBill');
const { CompaniDate } = require('../helpers/dates/companiDates');
const EmailHelper = require('../helpers/email');
const { DAY, VENDOR_ADMIN } = require('../helpers/constants');

const sendingPendingBillsByEmailJob = {
  async method(server) {
    try {
      const TODAY = CompaniDate().startOf(DAY).toISO();
      const pendingCourseBillList = await PendingCourseBill
        .find({ sendingDate: TODAY })
        .setOptions({ isVendorUser: true })
        .lean();
      const credentials = { role: { vendor: { name: VENDOR_ADMIN } } };

      const emailPromises = [];
      const pendingCourseBillPromises = [];
      for (const pendingCourseBill of pendingCourseBillList) {
        const { courseBills: courseBillIds, type, content, recipientEmails, sendingDate } = pendingCourseBill;

        const courseBills = await CourseBill
          .find({ _id: { $in: courseBillIds } })
          .populate({
            path: 'payer',
            populate: [{ path: 'company', select: 'name' }, { path: 'fundingOrganisation', select: 'name' }],
          })
          .populate({ path: 'companies', select: 'name' })
          .lean();

        emailPromises.push(
          EmailHelper.sendBillEmail(courseBills, type, content, recipientEmails, sendingDate, credentials)
        );
        pendingCourseBillPromises.push(PendingCourseBill.deleteOne({ _id: pendingCourseBill._id }));
      }

      const { fulfilled: emailFulfilled } = await Promise
        .allSettled(emailPromises)
        .then(docs => groupBy(docs, 'status'));

      const { fulfilled: pendingCourseBillDeletedFulfilled } = await Promise
        .allSettled(pendingCourseBillPromises)
        .then(docs => groupBy(docs, 'status'));
      return {
        day: TODAY,
        emailSent: emailFulfilled.length,
        pendingCourseBillDeleted: pendingCourseBillDeletedFulfilled.length,
      };
    } catch (e) {
      server.log(['cron', 'method'], e);
      return Boom.isBoom(e) ? e : Boom.badImplementation(e);
    }
  },
  async onComplete(server, { day, emailSent, pendingCourseBillDeleted }) {
    try {
      server.log(['cron'], 'sendingPendingBillsByEmail OK');

      await EmailHelper.completionSendingPendingBillsEmail(day, emailSent, pendingCourseBillDeleted);
      server.log(['cron', 'oncomplete'], 'Pending courseBills sending : email envoyé.');
    } catch (e) {
      server.log(e);
      server.log(['cron', 'oncomplete'], 'CompletionCertificateCreation ERROR');
    }
  },
};

module.exports = { sendingPendingBillsByEmailJob };
