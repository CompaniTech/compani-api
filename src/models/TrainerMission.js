const mongoose = require('mongoose');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { DAY, CREATION_METHOD_TYPES } = require('../helpers/constants');
const {
  formatQuery,
  queryMiddlewareList,
  getDocMiddlewareList,
  getDocListMiddlewareList,
} = require('./preHooks/validate');

const TrainerMissionSchema = mongoose.Schema({
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  courses: {
    type: [{
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
      fee: { type: Number },
    }],
    required: true,
    immutable: true,
  },
  date: { type: Date, default: CompaniDate().startOf(DAY).toISO() },
  file: {
    publicId: { type: String, required: true },
    link: { type: String, trim: true, required: true },
  },
  fee: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  creationMethod: { type: String, required: true, enum: CREATION_METHOD_TYPES, immutable: true },
  cancelledAt: { type: Date },
}, { timestamps: true });

function formatCourses(doc) {
  if (!doc || !Array.isArray(doc.courses)) return;

  // eslint-disable-next-line no-param-reassign
  doc.courses = doc.courses.map(course => (course._id instanceof mongoose.Types.ObjectId
    ? course
    : { ...course._id, fee: course.fee }));
}

function formatCoursesList(docs) {
  for (const doc of docs) formatCourses(doc);
}

queryMiddlewareList.map(middleware => TrainerMissionSchema.pre(middleware, formatQuery));
getDocMiddlewareList.map(middleware => TrainerMissionSchema.post(middleware, formatCourses));
getDocListMiddlewareList.map(middleware => TrainerMissionSchema.post(middleware, formatCoursesList));

module.exports = mongoose.model('TrainerMission', TrainerMissionSchema);
