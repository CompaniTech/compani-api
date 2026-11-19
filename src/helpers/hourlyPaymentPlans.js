const NumbersHelper = require('./numbers');
const UtilsHelper = require('./utils');
const { CompaniDuration } = require('./dates/companiDurations');
const { SHORT_DURATION_H_MM, PT0S } = require('./constants');

exports.getPricesFromDurations = (
  hourlyPaymentPlan,
  durationPerStep,
  eLearningDuration,
  steps,
  previousELearningDuration = CompaniDuration()
) => {
  const stepsPrices = Object.entries(durationPerStep).reduce((acc, [stepId, duration]) => {
    const stepPrice = hourlyPaymentPlan.prices.find(p => UtilsHelper.areObjectIdsEquals(p.step, stepId));
    if (!stepPrice) return acc;

    const { name: stepName } = steps.find(step => UtilsHelper.areObjectIdsEquals(step._id, stepId));

    const price = NumbersHelper.multiply(duration.asHours(), stepPrice.hourlyAmount);

    return { ...acc, [stepId]: { stepId, stepName, duration, price } };
  }, {});

  const eLearningMonthDuration = CompaniDuration(eLearningDuration);
  let billableELearningDuration = eLearningMonthDuration;
  if (hourlyPaymentPlan.elearningLimit) {
    const remainingDuration = CompaniDuration(hourlyPaymentPlan.elearningLimit).subtract(previousELearningDuration);
    if (remainingDuration.isShorterThan(eLearningMonthDuration)) {
      billableELearningDuration = remainingDuration.isShorterThan(PT0S) ? CompaniDuration(PT0S) : remainingDuration;
    }
  }
  const eLearning = hourlyPaymentPlan.elearningPrice && !billableELearningDuration.isEquivalentTo(PT0S) && {
    duration: billableELearningDuration,
    price: NumbersHelper.multiply(billableELearningDuration.asHours(), hourlyPaymentPlan.elearningPrice),
  };

  return { ...stepsPrices, ...eLearning && { elearning: eLearning } };
};

exports.getPriceDetails = priceDetails => Object.values(priceDetails)
  .map(line => `${line.stepName || 'E-learning'} - ${line.duration.format(SHORT_DURATION_H_MM)}`
    + ` - ${UtilsHelper.formatPrice(line.price)}`)
  .join('\r\n');
