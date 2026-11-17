const NumbersHelper = require('./numbers');
const UtilsHelper = require('./utils');
const { CompaniDuration } = require('./dates/companiDurations');
const { SHORT_DURATION_H_MM } = require('./constants');

exports.getPricesFromDurations = (hourlyPaymentPlan, durationPerStep, eLearningDuration, steps) => {
  const stepsPrices = Object.entries(durationPerStep).reduce((acc, [stepId, duration]) => {
    const stepPrice = hourlyPaymentPlan.prices.find(p => UtilsHelper.areObjectIdsEquals(p.step, stepId));
    if (!stepPrice) return acc;

    const { name: stepName } = steps.find(step => UtilsHelper.areObjectIdsEquals(step._id, stepId));

    const price = NumbersHelper.multiply(duration.asHours(), stepPrice.hourlyAmount);

    return { ...acc, [stepId]: { stepId, stepName, duration, price } };
  }, {});

  const eLearning = hourlyPaymentPlan.elearningPrice && {
    duration: CompaniDuration(eLearningDuration),
    price: NumbersHelper.multiply(CompaniDuration(eLearningDuration).asHours(), hourlyPaymentPlan.elearningPrice),
  };

  return { ...stepsPrices, ...eLearning && { elearning: eLearning } };
};

exports.getPriceDetails = priceDetails => Object.values(priceDetails)
  .map(line => `${line.stepName || 'E-learning'} - ${line.duration.format(SHORT_DURATION_H_MM)}`
    + ` - ${UtilsHelper.formatPrice(line.price)}`)
  .join('\r\n');
