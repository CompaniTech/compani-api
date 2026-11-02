const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const HourlyPaymentPlansHelper = require('../../../src/helpers/hourlyPaymentPlans');
const { CompaniDuration } = require('../../../src/helpers/dates/companiDurations');

describe('getPriceFromDurations', () => {
  it('should compute price from on-site steps and e-learning durations', () => {
    const stepIds = [new ObjectId(), new ObjectId()];
    const hourlyPaymentPlan = {
      prices: [{ step: stepIds[0], hourlyAmount: 50 }, { step: stepIds[1], hourlyAmount: 80 }],
      elearningPrice: 20,
    };
    const durationPerStep = {
      [stepIds[0]]: CompaniDuration({ minutes: 210 }),
      [stepIds[1]]: CompaniDuration({ minutes: 60 }),
    };

    const result = HourlyPaymentPlansHelper
      .getPriceFromDurations(hourlyPaymentPlan, durationPerStep, CompaniDuration({ minutes: 90 }));

    expect(result).toBe(50 * 3.5 + 80 + 20 * 1.5);
  });

  it('should ignore e-learning if there is no e-learning price', () => {
    const stepId = new ObjectId();
    const hourlyPaymentPlan = { prices: [{ step: stepId, hourlyAmount: 40 }] };

    const durationPerStep = { [stepId]: CompaniDuration({ minutes: 30 }) };

    const result = HourlyPaymentPlansHelper
      .getPriceFromDurations(hourlyPaymentPlan, durationPerStep, CompaniDuration({ hours: 2 }));

    expect(result).toBe(20);
  });
});
