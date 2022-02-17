const Joi = require('joi');
const { SERVICE_NATURES } = require('../../models/Service');
const { billingItemListValidations } = require('./billingItem');

exports.creditNoteValidations = {
  date: Joi.date().required(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  exclTaxesCustomer: Joi.number().when('billingItemList', { is: Joi.exist(), then: Joi.required() }),
  inclTaxesCustomer: Joi.number().when('billingItemList', { is: Joi.exist(), then: Joi.required() }),
  exclTaxesTpp: Joi.number(),
  inclTaxesTpp: Joi.number(),
  events: Joi.array().items(Joi.object().keys({
    eventId: Joi.objectId().required(),
    auxiliary: Joi.objectId().required(),
    serviceName: Joi.string().required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    bills: Joi.object().keys({
      inclTaxesCustomer: Joi.number(),
      exclTaxesCustomer: Joi.number(),
      thirdPartyPayer: Joi.objectId(),
      inclTaxesTpp: Joi.number(),
      exclTaxesTpp: Joi.number(),
      fundingId: Joi.objectId(),
      nature: Joi.string(),
      careHours: Joi.number(),
      surcharges: Joi.array().items(Joi.object({
        percentage: Joi.number().required(),
        name: Joi.string().required(),
        startHour: Joi.date(),
        endHour: Joi.date(),
      })),
      billingItems: Joi.array().items(Joi.object({
        billingItem: Joi.objectId(),
        exclTaxes: Joi.number(),
        inclTaxes: Joi.number(),
      })),
    }).required(),
  })),
  subscription: Joi.object().keys({
    _id: Joi.objectId(),
    service: Joi.object().required().keys({
      serviceId: Joi.objectId().required(),
      name: Joi.string().required(),
      nature: Joi.string().required().valid(...SERVICE_NATURES),
    }),
    vat: Joi.number(),
    unitInclTaxes: Joi.number(),
  }),
  misc: Joi.string(),
  ...billingItemListValidations,
};
