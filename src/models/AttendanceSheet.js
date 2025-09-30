const mongoose = require('mongoose');
const { validateQuery, validateAggregation, formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { ORIGIN_OPTIONS } = require('../helpers/constants');

const AttendanceSheetSchema = mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  file: {
    publicId: {
      type: String,
      validate: {
        validator(value) {
          if (!this.slots?.some(slot => slot.trainerSignature)) {
            return !!value;
          }
          return true;
        },
        message: 'file.publicId is required when there is no trainer signature.',
      },
    },
    link: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          if (!this.slots?.some(slot => slot.trainerSignature)) {
            return !!value;
          }
          return true;
        },
        message: 'file.link is required when there is no trainer signature.',
      },
    },
  },
  date: { type: Date },
  trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companies: { type: [mongoose.Schema.Types.ObjectId], ref: 'Company', required: true },
  origin: { type: String, enum: ORIGIN_OPTIONS, required: true, immutable: true },
  slots: {
    type: [mongoose.Schema({
      slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseSlot' },
      trainerSignature: {
        type: mongoose.Schema({
          trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          signature: { type: String, trim: true },
        }),
        default: undefined,
        _id: false,
        id: false,
      },
      traineesSignature: {
        type: [mongoose.Schema({
          traineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          signature: { type: String, trim: true, required() { return !!this.slots?.trainerSignature; } },
        })],
        default: undefined,
        _id: false,
        id: false,
      },
    })],
    default: undefined,
    _id: false,
    id: false,
  },
}, { timestamps: true, id: false });

AttendanceSheetSchema.pre('find', validateQuery);
AttendanceSheetSchema.pre('aggregate', validateAggregation);
queryMiddlewareList.map(middleware => AttendanceSheetSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('AttendanceSheet', AttendanceSheetSchema);
