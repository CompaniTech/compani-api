const crypto = require('crypto');

exports.encrypt = (text) => {
  const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
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
