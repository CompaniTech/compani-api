const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const HourlyPaymentPlansHelper = require('../../../src/helpers/hourlyPaymentPlans');
const { CompaniDuration } = require('../../../src/helpers/dates/companiDurations');

describe('getPricesFromDurations', () => {
  it('should return a price line per priced step and one for e-learning', () => {
    const steps = [{ _id: new ObjectId(), name: 'étape A' }, { _id: new ObjectId(), name: 'étape B' }];
    const hourlyPaymentPlan = {
      prices: [{ step: steps[0]._id, hourlyAmount: 50 }, { step: steps[1]._id, hourlyAmount: 80 }],
      elearningPrice: 20,
    };
    const durationPerStep = {
      [steps[0]._id]: CompaniDuration({ minutes: 210 }),
      [steps[1]._id]: CompaniDuration({ minutes: 60 }),
    };
    const eLearningDuration = CompaniDuration({ minutes: 90 });

    const result = HourlyPaymentPlansHelper
      .getPricesFromDurations(hourlyPaymentPlan, durationPerStep, eLearningDuration, steps);

    expect(Object.keys(result)).toEqual([steps[0]._id.toHexString(), steps[1]._id.toHexString(), 'elearning']);
    expect(result[steps[0]._id]).toEqual({
      stepId: steps[0]._id.toHexString(),
      stepName: 'étape A',
      duration: durationPerStep[steps[0]._id],
      price: '175',
    });
    expect(result[steps[1]._id]).toEqual({
      stepId: steps[1]._id.toHexString(),
      stepName: 'étape B',
      duration: durationPerStep[steps[1]._id],
      price: '80',
    });
    expect(result.elearning.price).toBe('30');
    expect(result.elearning.duration.asMinutes()).toBe(90);
  });

  it('should not return e-learning line if there is no e-learning price', () => {
    const steps = [{ _id: new ObjectId(), name: 'étape A' }];
    const hourlyPaymentPlan = { prices: [{ step: steps[0]._id, hourlyAmount: 40 }] };
    const durationPerStep = { [steps[0]._id]: CompaniDuration({ minutes: 30 }) };

    const result = HourlyPaymentPlansHelper
      .getPricesFromDurations(hourlyPaymentPlan, durationPerStep, CompaniDuration({ hours: 2 }), steps);

    expect(Object.keys(result)).toEqual([steps[0]._id.toHexString()]);
  });

  it('should ignore steps without price in the plan', () => {
    const steps = [{ _id: new ObjectId(), name: 'étape A' }];
    const hourlyPaymentPlan = { prices: [] };
    const durationPerStep = { [steps[0]._id]: CompaniDuration({ minutes: 30 }) };

    const result = HourlyPaymentPlansHelper
      .getPricesFromDurations(hourlyPaymentPlan, durationPerStep, CompaniDuration({ hours: 2 }), steps);

    expect(result).toEqual({});
  });
});

describe('getPriceDetails', () => {
  it('should return one line per price line (name - duration - price)', () => {
    const priceDetails = {
      [new ObjectId()]: { stepName: 'étape A', duration: CompaniDuration({ minutes: 210 }), price: '175' },
      [new ObjectId()]: { stepName: 'étape B', duration: CompaniDuration({ minutes: 60 }), price: '80' },
      elearning: { duration: CompaniDuration({ minutes: 90 }), price: '30' },
    };

    const result = HourlyPaymentPlansHelper.getPriceDetails(priceDetails);

    expect(result).toBe(
      'étape A - 3h30 - 175,00\u00a0€\r\n'
      + 'étape B - 1h - 80,00\u00a0€\r\n'
      + 'E-learning - 1h30 - 30,00\u00a0€'
    );
  });
});
