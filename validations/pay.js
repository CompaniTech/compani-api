const Joi = require('joi');

const surchargedHoursValidation = Joi.object().keys({
  hours: Joi.number().required(),
  percentage: Joi.number().required().min(0).max(100),
});

const surchargedDetailsValidation = Joi.object().required().pattern(Joi.string(), {
  planName: Joi.string().required(),
  saturday: surchargedHoursValidation,
  sunday: surchargedHoursValidation,
  publicHoliday: surchargedHoursValidation,
  twentyFifthOfDecember: surchargedHoursValidation,
  firstOfMay: surchargedHoursValidation,
  evening: surchargedHoursValidation,
  custom: surchargedHoursValidation,
});

exports.payValidation = {
  additionalHours: Joi.number().required(),
  auxiliary: Joi.objectId().required(),
  bonus: Joi.number().required(),
  contractHours: Joi.number().required(),
  diff: Joi.object().keys({
    hoursBalance: Joi.number().required(),
    notSurchargedAndExempt: Joi.number().required(),
    notSurchargedAndNotExempt: Joi.number().required(),
    surchargedAndExempt: Joi.number().required(),
    surchargedAndExemptDetails: surchargedDetailsValidation.required(),
    surchargedAndNotExempt: Joi.number().required(),
    surchargedAndNotExemptDetails: surchargedDetailsValidation.required(),
    workedHours: Joi.number().required(),
  }),
  endDate: Joi.date().required(),
  hoursBalance: Joi.number().required(),
  hoursCounter: Joi.number().required(),
  hoursToWork: Joi.number().required(),
  month: Joi.string().required(),
  mutual: Joi.boolean().required(),
  notSurchargedAndExempt: Joi.number().required(),
  notSurchargedAndNotExempt: Joi.number().required(),
  otherFees: Joi.number().required(),
  overtimeHours: Joi.number().required(),
  previousMonthHoursCounter: Joi.number().required(),
  startDate: Joi.date().required(),
  surchargedAndExempt: Joi.number().required(),
  surchargedAndExemptDetails: surchargedDetailsValidation,
  surchargedAndNotExempt: Joi.number().required(),
  surchargedAndNotExemptDetails: surchargedDetailsValidation,
  transport: Joi.number().required(),
  workedHours: Joi.number().required(),
};
