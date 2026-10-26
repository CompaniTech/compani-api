const crypto = require('crypto');
const sinon = require('sinon');
const { expect } = require('expect');

const encryptionPath = require.resolve('../../../src/helpers/encryption');

describe('ENCRYPTION', () => {
  let EncryptionHelper;
  let scryptSyncStub;
  let randomBytesStub;
  let createCipherivStub;
  let createDeCipherivStub;
  beforeEach(() => {
    // encryption key is cached in the module, reload it to start each test with an empty cache
    delete require.cache[encryptionPath];
    // eslint-disable-next-line import/no-dynamic-require
    EncryptionHelper = require(encryptionPath);
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

    it('should derive the key only once', async () => {
      const iv = Buffer.alloc(16, 1);
      const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);
      const cipherIv = { update: sinon.stub().returns('a'), final: sinon.stub().returns('b') };
      scryptSyncStub.returns(ENCRYPTION_KEY);
      randomBytesStub.returns(iv);
      createCipherivStub.returns(cipherIv);

      EncryptionHelper.encrypt('text1');
      EncryptionHelper.encrypt('text2');

      sinon.assert.calledOnce(scryptSyncStub);
      sinon.assert.calledTwice(createCipherivStub);
    });
  });

  describe('encryptObject', () => {
    it('should encrypt every field, arrays being encrypted as a whole', () => {
      const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);
      const iv = Buffer.alloc(16, 1);
      const cipherIv = {
        update: sinon.stub(),
        final: sinon.stub(),
      };
      cipherIv.update.onCall(0).returns('city');
      cipherIv.final.onCall(0).returns('Encrypted');
      cipherIv.update.onCall(1).returns('type');
      cipherIv.final.onCall(1).returns('Encrypted');
      cipherIv.update.onCall(2).returns('coordinates');
      cipherIv.final.onCall(2).returns('Encrypted');
      scryptSyncStub.returns(ENCRYPTION_KEY);
      randomBytesStub.returns(iv);
      createCipherivStub.returns(cipherIv);

      const result = EncryptionHelper.encryptObject({
        city: 'Paris',
        location: { type: 'Point', coordinates: [4.8, 2.9] },
        encrypted: '01010101010101010101010101010101:alreadyEncrypted',
      });

      expect(result).toEqual({
        city: '01010101010101010101010101010101:cityEncrypted',
        location: {
          type: '01010101010101010101010101010101:typeEncrypted',
          coordinates: '01010101010101010101010101010101:coordinatesEncrypted',
        },
        encrypted: '01010101010101010101010101010101:alreadyEncrypted',
      });

      sinon.assert.calledOnceWithExactly(scryptSyncStub, process.env.ENCRYPTION_KEY, 'salt', 32);
      sinon.assert.calledWithExactly(randomBytesStub.getCall(0), 16);
      sinon.assert.calledWithExactly(randomBytesStub.getCall(1), 16);
      sinon.assert.calledWithExactly(randomBytesStub.getCall(2), 16);
      sinon.assert.calledWithExactly(createCipherivStub.getCall(0), 'aes-256-cbc', ENCRYPTION_KEY, iv);
      sinon.assert.calledWithExactly(createCipherivStub.getCall(1), 'aes-256-cbc', ENCRYPTION_KEY, iv);
      sinon.assert.calledWithExactly(createCipherivStub.getCall(2), 'aes-256-cbc', ENCRYPTION_KEY, iv);
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

  describe('decryptObject', () => {
    it('should decrypt every encrypted field and keep the other ones', () => {
      const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);
      const iv = Buffer.from('01010101010101010101010101010101', 'hex');
      const decipherIv = {
        update: sinon.stub(),
        final: sinon.stub(),
      };
      decipherIv.update.onFirstCall().returns('"Pa');
      decipherIv.final.onFirstCall().returns('ris"');
      decipherIv.update.onSecondCall().returns('[4.8,');
      decipherIv.final.onSecondCall().returns('2.9]');
      scryptSyncStub.returns(ENCRYPTION_KEY);
      createDeCipherivStub.returns(decipherIv);

      const result = EncryptionHelper.decryptObject({
        city: '01010101010101010101010101010101:cityEncrypted',
        location: {
          type: 'Point',
          coordinates: '01010101010101010101010101010101:coordinatesEncrypted',
        },
        clearCoordinates: [4.8, 2.9],
      });

      expect(result).toEqual({
        city: 'Paris',
        location: { type: 'Point', coordinates: [4.8, 2.9] },
        clearCoordinates: [4.8, 2.9],
      });

      sinon.assert.calledOnceWithExactly(scryptSyncStub, process.env.ENCRYPTION_KEY, 'salt', 32);
      sinon.assert.calledWithExactly(createDeCipherivStub.getCall(0), 'aes-256-cbc', ENCRYPTION_KEY, iv);
      sinon.assert.calledWithExactly(createDeCipherivStub.getCall(1), 'aes-256-cbc', ENCRYPTION_KEY, iv);
      sinon.assert.notCalled(randomBytesStub);
      sinon.assert.notCalled(createCipherivStub);
    });
  });
});
