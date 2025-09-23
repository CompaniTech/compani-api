const mongoose = require('mongoose');
const { validateQuery } = require('./preHooks/validate');

const XmlSEPAFileInfosSchema = mongoose.Schema({
  coursePayments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CoursePayment', required: true }],
  name: { type: String, required: true, unique: true },
});

XmlSEPAFileInfosSchema.pre('find', validateQuery);
module.exports = mongoose.model('XmlSEPAFileInfos', XmlSEPAFileInfosSchema);
