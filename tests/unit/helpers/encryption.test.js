const crypto = require('crypto');
const sinon = require('sinon');
const { expect } = require('expect');
const EncryptionHelper = require('../../../src/helpers/encryption');

describe('ENCRYPTION', () => {
  let scryptSyncStub;
  let randomBytesStub;
  let createCipherivStub;
  let createDeCipherivStub;
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'f7c83b1820298f0cdaa9795dda786a589bc7376ab31006ab33b66184e093ab94';
    scryptSyncStub = sinon.stub(crypto, 'scryptSync');
    randomBytesStub = sinon.stub(crypto, 'randomBytes');
    createCipherivStub = sinon.stub(crypto, 'createCipheriv');
    createDeCipherivStub = sinon.stub(crypto, 'createDecipheriv');
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = '';
    scryptSyncStub.restore();
    randomBytesStub.restore();
    createCipherivStub.restore();
    createDeCipherivStub.restore();
  });

  describe('encrypt', () => {
    it('should encrypt text', async () => {
      const iv = Buffer.alloc(16, 1);
      const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);
      const cipherIv = {
        update: sinon.stub().returns('textEncrypted'),
        final: sinon.stub().returns('Final'),
      };
      scryptSyncStub.returns(ENCRYPTION_KEY);
      randomBytesStub.returns(iv);
      createCipherivStub.returns(cipherIv);

      const result = await EncryptionHelper.encrypt('textACrypter');

      const [ivHex, encryptedHex] = result.split(':');
      expect(ivHex).toEqual('01010101010101010101010101010101');
      expect(encryptedHex).toEqual('textEncryptedFinal');

      sinon.assert.calledOnceWithExactly(scryptSyncStub, process.env.ENCRYPTION_KEY, 'salt', 32);
      sinon.assert.calledOnceWithExactly(randomBytesStub, 16);
      sinon.assert.calledOnceWithExactly(createCipherivStub, 'aes-256-cbc', ENCRYPTION_KEY, iv);
      sinon.assert.notCalled(createDeCipherivStub);
    });
  });

  describe('decrypt', () => {
    it('should decrypt text', async () => {
      const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);
      const iv = Buffer.from('01010101010101010101010101010101', 'hex');
      const decipherIv = {
        update: sinon.stub().returns('textA'),
        final: sinon.stub().returns('Crypter'),
      };
      scryptSyncStub.returns(ENCRYPTION_KEY);
      createDeCipherivStub.returns(decipherIv);

      const result = await EncryptionHelper.decrypt('01010101010101010101010101010101:textEncryptedFinal');

      expect(result).toEqual('textACrypter');

      sinon.assert.calledOnceWithExactly(scryptSyncStub, process.env.ENCRYPTION_KEY, 'salt', 32);
      sinon.assert.calledOnceWithExactly(createDeCipherivStub, 'aes-256-cbc', ENCRYPTION_KEY, iv);
      sinon.assert.notCalled(randomBytesStub);
      sinon.assert.notCalled(createCipherivStub);
    });
  });
});
