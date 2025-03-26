const Joi = require('joi');
const {
  MONTH_VALIDATION,
  PHONE_VALIDATION,
  SIRET_VALIDATION,
  IBAN_VALIDATION,
  BIC_VALIDATION,
  COUNTRY_CODE_VALIDATION,
} = require('../../models/utils');
const { CompaniDuration, ISO_DURATION_VALIDATION } = require('../../helpers/dates/companiDurations');
const { PT0S } = require('../../helpers/constants');

const dateToISOString = Joi.date().custom(value => value.toISOString());
const requiredDateToISOString = Joi.date().required().custom(value => value.toISOString());

const durationStrictlyPositive = Joi.string().regex(ISO_DURATION_VALIDATION).custom((value, helper) => {
  try {
    const duration = CompaniDuration(value);

    return duration.isLongerThan(PT0S) ? value : helper.message('Duration should be strictly positive');
  } catch (e) {
    const msg = `Error in custom joi validation durationStrictlyPositive :  ${e.message}`;
    return helper.message(msg);
  }
});

const durationPositive = Joi.string().regex(ISO_DURATION_VALIDATION).custom((value, helper) => {
  try {
    const duration = CompaniDuration(value);

    return duration.isLongerThan(PT0S) || duration.isEquivalentTo(PT0S)
      ? value
      : helper.message('Duration should be strictly positive');
  } catch (e) {
    const msg = `Error in custom joi validation durationStrictlyPositive :  ${e.message}`;
    return helper.message(msg);
  }
});

const monthValidation = Joi.string().regex(MONTH_VALIDATION);
const phoneNumberValidation = Joi.string().regex(PHONE_VALIDATION);
const countryCodeValidation = Joi.string().regex(COUNTRY_CODE_VALIDATION);

const addressValidation = Joi.object().keys({
  street: Joi.string().required(),
  zipCode: Joi.string().required(),
  city: Joi.string().required(),
  fullAddress: Joi.string().required(),
  location: Joi.object().keys({
    type: Joi.string().required(),
    coordinates: Joi.array().length(2).required(),
  }).required(),
});

const objectIdOrArray = Joi.alternatives().try(Joi.objectId(), Joi.array().items(Joi.objectId()));

const stringOrArray = valid => (valid
  ? Joi.alternatives().try(Joi.string().valid(...valid), Joi.array().items(Joi.string().valid(...valid)))
  : Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()))
);

const expoTokenValidation = Joi.string().custom((value, helper) => (
  value.substring(0, 18) === 'ExponentPushToken['
    ? value
    : helper.message('Wrong ExponentPushToken type')
));

const formDataPayload = (maxSize = 5242880) => ({
  output: 'stream',
  parse: true,
  multipart: true,
  allow: 'multipart/form-data',
  maxBytes: maxSize,
});

const siretValidation = Joi.string().regex(SIRET_VALIDATION);
const ibanValidation = Joi.string().regex(IBAN_VALIDATION);
const bicValidation = Joi.string().regex(BIC_VALIDATION);

module.exports = {
  monthValidation,
  phoneNumberValidation,
  countryCodeValidation,
  addressValidation,
  objectIdOrArray,
  stringOrArray,
  expoTokenValidation,
  formDataPayload,
  dateToISOString,
  requiredDateToISOString,
  siretValidation,
  ibanValidation,
  bicValidation,
  durationStrictlyPositive,
  durationPositive,
};
