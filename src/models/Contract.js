const mongoose = require('mongoose');
const { validatePayload, validateQuery, validateAggregation } = require('./preHooks/validate');

const {
  EMPLOYER_TRIAL_PERIOD_TERMINATION,
  EMPLOYEE_TRIAL_PERIOD_TERMINATION,
  RESIGNATION,
  SERIOUS_MISCONDUCT_LAYOFF,
  GROSS_FAULT_LAYOFF,
  OTHER_REASON_LAYOFF,
  MUTATION,
  CONTRACTUAL_TERMINATION,
  INTERNSHIP_END,
  CDD_END,
  OTHER,
} = require('../helpers/constants');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');

const END_CONTRACT_REASONS = [
  EMPLOYER_TRIAL_PERIOD_TERMINATION,
  EMPLOYEE_TRIAL_PERIOD_TERMINATION,
  RESIGNATION,
  SERIOUS_MISCONDUCT_LAYOFF,
  GROSS_FAULT_LAYOFF,
  OTHER_REASON_LAYOFF,
  MUTATION,
  CONTRACTUAL_TERMINATION,
  INTERNSHIP_END,
  CDD_END,
  OTHER,
];

const ContractSchema = mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  endReason: { type: String, enum: END_CONTRACT_REASONS },
  otherMisc: { type: String },
  endNotificationDate: { type: Date },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  versions: [{
    signature: {
      eversignId: String,
      signedBy: {
        auxiliary: { type: Boolean, default: false },
        other: { type: Boolean, default: false },
      },
    },
    createdAt: { type: Date, default: Date.now },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    weeklyHours: { type: Number },
    grossHourlyRate: { type: Number, required: true },
    auxiliaryDoc: driveResourceSchemaDefinition,
    auxiliaryArchives: [driveResourceSchemaDefinition],
  }],
}, {
  timestamps: true,
});

ContractSchema.pre('validate', validatePayload);
ContractSchema.pre('find', validateQuery);
ContractSchema.pre('aggregate', validateAggregation);

module.exports = mongoose.model('Contract', ContractSchema);
module.exports.END_CONTRACT_REASONS = END_CONTRACT_REASONS;
