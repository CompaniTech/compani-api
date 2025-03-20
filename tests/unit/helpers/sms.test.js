const sinon = require('sinon');
const { expect } = require('expect');
const { PASSWORD_SMS } = require('../../../src/helpers/constants');
const SmsHelper = require('../../../src/helpers/sms');

describe('sendVerificationCodeSms', () => {
  let send;
  beforeEach(() => {
    send = sinon.stub(SmsHelper, 'send');
  });
  afterEach(() => {
    send.restore();
  });

  it('shoud sent sms with verification code', async () => {
    const result = await SmsHelper.sendVerificationCodeSms({ phone: '0987654321', countryCode: '+33' }, '1234');

    expect(result).toEqual({ phone: '0987654321', countryCode: '+33' });
    sinon.assert.calledOnceWithExactly(
      send,
      {
        tag: PASSWORD_SMS,
        content: 'Votre code Compani : 1234.'
          + ' Veuillez utiliser ce code, valable une heure, pour confirmer votre identité.',
        recipient: '+33 9 87 65 43 21',
        sender: 'Compani',
      }
    );
  });
});
