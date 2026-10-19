const crypto = require('crypto');

exports.encrypt = (text) => {
  const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

exports.encryptObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    if (isEncrypted(obj)) return obj;
    return exports.encrypt(JSON.stringify(obj));
  }

  const result = {};
  for (const key of Object.keys(obj)) result[key] = exports.encryptObject(obj[key]);

  return result;
};

exports.decrypt = (data) => {
  const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

  const [ivHex, encryptedData] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

exports.decryptObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return isEncrypted(obj) ? JSON.parse(exports.decrypt(obj)) : obj;

  const plain = typeof obj.toObject === 'function' ? obj.toObject({ virtuals: false }) : obj;
  const result = {};
  for (const key of Object.keys(plain)) result[key] = exports.decryptObject(plain[key]);

  return result;
};

const isEncrypted = value => typeof value === 'string' && value.includes(':');
