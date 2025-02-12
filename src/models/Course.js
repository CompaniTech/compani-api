const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { INTRA, INTER_B2B, INTER_B2C, INTRA_HOLDING, STRICTLY_E_LEARNING, BLENDED } = require('../helpers/constants');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const COURSE_TYPES = [INTRA, INTER_B2B, INTER_B2C, INTRA_HOLDING];
const COURSE_FORMATS = [STRICTLY_E_LEARNING, BLENDED];

const CourseSchema = mongoose.Schema({
  misc: { type: String },
  subProgram: { type: mongoose.Schema.Types.ObjectId, ref: 'SubProgram', required: true },
  companies: {
    type: [mongoose.Schema.Types.ObjectId],
    default() { return (this.type === INTER_B2C ? undefined : []); },
    ref: 'Company',
    validate(v) { return (this.type === INTRA ? Array.isArray(v) && !!v.length : true); },
  },
  holding: {
    type: mongoose.Schema.Types.ObjectId,
    required() { return this.type === INTRA_HOLDING; },
    ref: 'Holding',
  },
  type: { type: String, required: true, enum: COURSE_TYPES },
  format: { type: String, enum: COURSE_FORMATS, default: BLENDED },
  trainers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },
  trainees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accessRules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
  operationsRepresentative: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required() { return this.format === BLENDED; },
  },
  companyRepresentative: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  estimatedStartDate: { type: Date },
  archivedAt: { type: Date },
  maxTrainees: { type: Number, required() { return [INTRA, INTRA_HOLDING].includes(this.type); } },
  expectedBillsCount: { type: Number, default() { return this.type === INTRA ? 0 : undefined; } },
  hasCertifyingTest: { type: Boolean, default() { return this.format === BLENDED ? false : undefined; } },
  certifiedTrainees: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: undefined,
  },
  salesRepresentative: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tutors: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },
}, { timestamps: true });

CourseSchema.virtual('slots', {
  ref: 'CourseSlot',
  localField: '_id',
  foreignField: 'course',
  options: { match: { startDate: { $exists: true } }, sort: { startDate: 1 } },
});

CourseSchema.virtual('slotsToPlan', {
  ref: 'CourseSlot',
  localField: '_id',
  foreignField: 'course',
  options: { match: { startDate: { $exists: false } } },
});

CourseSchema.virtual('bills', {
  ref: 'CourseBill',
  localField: '_id',
  foreignField: 'course',
  options: { sort: { createdAt: -1 } },
});

CourseSchema.virtual('trainerMissions', {
  ref: 'TrainerMission',
  localField: '_id',
  foreignField: 'courses',
  options: { match: { cancelledAt: { $exists: false } } },
});

CourseSchema.virtual('attendanceSheets', {
  ref: 'AttendanceSheet',
  localField: '_id',
  foreignField: 'course',
  options: { sort: { createdAt: 1 } },
});

queryMiddlewareList.map(middleware => CourseSchema.pre(middleware, formatQuery));

CourseSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('Course', CourseSchema);
module.exports.COURSE_TYPES = COURSE_TYPES;
module.exports.COURSE_FORMATS = COURSE_FORMATS;
