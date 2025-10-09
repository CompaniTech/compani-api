const MONTH_VALIDATION = /^([0]{1}[1-9]{1}|[1]{1}[0-2]{1})-[2]{1}[0]{1}[0-9]{2}$/;
const PHONE_VALIDATION = /^[0]{1}[1-9]{1}[0-9]{8}$/;
const COUNTRY_CODE_VALIDATION = /^\+([1-9][0-9]{0,2})$/;
const SIRET_VALIDATION = /^\d{14}$/;
const IBAN_VALIDATION = /^FR\d{12}[0-9A-Z]{11}\d{2}$/;
const BIC_VALIDATION = /^[A-Z]{6}[0-9A-Z]{2}([0-9A-Z]{3})?$/;
const ICS_VALIDATION = /^FR[0-9A-Z]{11}$/;
const EMAIL_VALIDATION = /^[\w-.+]+@([\w-]+\.)+[\w-]{2,4}$/;
const SUFFIX_EMAIL_VALIDATION = /^@([\w-]+\.)+[\w-]{2,4}$/;

module.exports = {
  MONTH_VALIDATION,
  PHONE_VALIDATION,
  COUNTRY_CODE_VALIDATION,
  SIRET_VALIDATION,
  IBAN_VALIDATION,
  BIC_VALIDATION,
  ICS_VALIDATION,
  EMAIL_VALIDATION,
  SUFFIX_EMAIL_VALIDATION,
};
