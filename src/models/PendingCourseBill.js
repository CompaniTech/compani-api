const mongoose = require('mongoose');
const {
  validateQuery,
  validateUpdateOne,
} = require('./preHooks/validate');
const { VAEI, START_COURSE, END_COURSE, MIDDLE_COURSE } = require('../helpers/constants');

const PendingCourseBillSchema = mongoose.Schema({
  courseBills: { type: [mongoose.Schema.Types.ObjectId], ref: 'CourseBill', required: true },
  sendingDate: { type: Date, required: true },
  recipientEmails: { type: [String], lowercase: true, trim: true, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: [VAEI, START_COURSE, END_COURSE, MIDDLE_COURSE], required: true },
}, { timestamps: true });

PendingCourseBillSchema.pre('find', validateQuery);
PendingCourseBillSchema.pre('updateOne', validateUpdateOne);

module.exports = mongoose.model('PendingCourseBill', PendingCourseBillSchema);
