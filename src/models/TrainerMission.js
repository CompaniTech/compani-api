const mongoose = require('mongoose');
const { CompaniDate } = require('../helpers/dates/companiDates');
const { DAY, CREATION_METHOD_TYPES } = require('../helpers/constants');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const TrainerMissionSchema = mongoose.Schema({
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  courses: { type: [mongoose.Schema.Types.ObjectId], ref: 'Course', required: true, immutable: true },
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

queryMiddlewareList.map(middleware => TrainerMissionSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('TrainerMission', TrainerMissionSchema);
