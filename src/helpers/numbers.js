const { BigNumber } = require('bignumber.js');

exports.toString = a => BigNumber(a).toString();

exports.toNumber = a => BigNumber(a).toNumber();

exports.toFixedToFloat = (a, decimalPlaces = 2) => parseFloat(BigNumber(a).toFixed(decimalPlaces));

exports.oldMultiply = (...nums) => nums.reduce((acc, n) => BigNumber(acc).multipliedBy(n).toNumber(), 1);

exports.multiply = (...nums) => nums.reduce((acc, n) => BigNumber(acc).multipliedBy(n).toString(), 1);

exports.oldDivide = (a, b) => BigNumber(a).dividedBy(b).toNumber();

exports.divide = (a, b) => BigNumber(a).dividedBy(b).toString();

exports.oldAdd = (...nums) => nums.reduce((acc, n) => BigNumber(acc).plus(n).toNumber(), 0);

exports.add = (...nums) => nums.reduce((acc, n) => BigNumber(acc).plus(n).toString(), 0);

exports.oldSubtract = (a, b) => BigNumber(a).minus(b).toNumber();

exports.subtract = (a, b) => BigNumber(a).minus(b).toString();

exports.isGreaterThan = (a, b) => BigNumber(a).isGreaterThan(b);

exports.isLessThan = (a, b) => BigNumber(a).isLessThan(b);

exports.isEqualTo = (a, b) => BigNumber(a).isEqualTo(b);
