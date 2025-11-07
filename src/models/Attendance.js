const mongoose = require('mongoose');
const { PRESENT, MISSING } = require('../helpers/constants');
const { validateQuery, validateAggregation, formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const ATTENDANCE_STATUS_TYPES = [PRESENT, MISSING];

const AttendanceSchema = mongoose.Schema({
  trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseSlot: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseSlot', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  status: { type: String, default: PRESENT, enum: ATTENDANCE_STATUS_TYPES },
}, { timestamps: true });

AttendanceSchema.pre('find', validateQuery);
AttendanceSchema.pre('aggregate', validateAggregation);
queryMiddlewareList.map(middleware => AttendanceSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('Attendance', AttendanceSchema);
