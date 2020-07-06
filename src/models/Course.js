const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { INTRA, INTER_B2B } = require('../helpers/constants');
const { PHONE_VALIDATION } = require('./utils');

const COURSE_TYPES = [INTRA, INTER_B2B];

const CourseSchema = mongoose.Schema({
  name: { type: String, required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required() { return this.type === INTRA; } },
  type: { type: String, required: true, enum: COURSE_TYPES },
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trainees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contact: {
    name: { type: String, default: '' },
    email: { type: String },
    phone: { type: String, validate: PHONE_VALIDATION },
  },
}, { timestamps: true });

function getCompanies() {
  const redundantCompanies = this.trainees.map(t => t.company._id.toHexString());
  return [...new Set(redundantCompanies)];
}

CourseSchema.virtual('slots', {
  ref: 'CourseSlot',
  localField: '_id',
  foreignField: 'courseId',
  options: { sort: { startDate: 1 } },
});

CourseSchema
  .virtual('companies')
  .get(getCompanies);

CourseSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('Course', CourseSchema);
module.exports.COURSE_TYPES = COURSE_TYPES;
