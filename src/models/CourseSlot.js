const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const { MISSING, PAID, NOT_PAID } = require('../helpers/constants');

const COURSE_SLOT_STATUS = [PAID, NOT_PAID];

const CourseSlotSchema = mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  startDate: { type: Date, required() { return !!this.endDate; } },
  endDate: { type: Date, required() { return !!this.startDate; } },
  address: { type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }) },
  meetingLink: { type: String, trim: true },
  step: { type: mongoose.Schema.Types.ObjectId, ref: 'Step', required: true },
  trainees: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: undefined },
  trainers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: undefined },
  status: { type: String, enum: COURSE_SLOT_STATUS, default: NOT_PAID },
}, { timestamps: true });

queryMiddlewareList.map(middleware => CourseSlotSchema.pre(middleware, formatQuery));

CourseSlotSchema.virtual('attendances', { ref: 'Attendance', localField: '_id', foreignField: 'courseSlot' });

CourseSlotSchema.virtual(
  'missingAttendances',
  { ref: 'Attendance', localField: '_id', foreignField: 'courseSlot', match: { status: MISSING } }
);

module.exports = mongoose.model('CourseSlot', CourseSlotSchema);
