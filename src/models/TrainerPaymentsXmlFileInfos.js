const mongoose = require('mongoose');
const { validateQuery } = require('./preHooks/validate');

const TrainerPaymentsXmlFileInfosSchema = mongoose.Schema({
  trainerPayments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TrainerPayment', required: true }],
  name: { type: String, required: true, unique: true },
}, { timestamps: true });

TrainerPaymentsXmlFileInfosSchema.pre('find', validateQuery);
module.exports = mongoose.model('TrainerPaymentsXmlFileInfos', TrainerPaymentsXmlFileInfosSchema);
