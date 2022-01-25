const mongoose = require('mongoose');
const { formatQuery, formatQueryMiddlewareList } = require('./preHooks/validate');

const AttendanceSchema = mongoose.Schema({
  trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseSlot: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseSlot', required: true },
}, { timestamps: true });

formatQueryMiddlewareList().map(middleware => AttendanceSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('Attendance', AttendanceSchema);
