const NumbersHelper = require('./numbers');
const UtilsHelper = require('./utils');
const { CompaniDuration } = require('./dates/companiDurations');

exports.getPriceFromDurations = (hourlyPaymentPlan, durationPerStep, eLearningDuration) => {
  const stepsPrice = Object.entries(durationPerStep).reduce((acc, [stepId, duration]) => {
    const stepPrice = hourlyPaymentPlan.prices.find(p => UtilsHelper.areObjectIdsEquals(p.step, stepId));
    if (!stepPrice) return acc;

    return NumbersHelper.add(acc, NumbersHelper.multiply(duration.asHours(), stepPrice.hourlyAmount));
  }, 0);

  const eLearningPrice = hourlyPaymentPlan.elearningPrice
    ? NumbersHelper.multiply(CompaniDuration(eLearningDuration).asHours(), hourlyPaymentPlan.elearningPrice)
    : 0;

  return NumbersHelper.toFixedToFloat(NumbersHelper.add(stepsPrice, eLearningPrice));
};
