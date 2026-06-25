const { BigNumber } = require('bignumber.js');
const { expect } = require('expect');
const NumbersHelper = require('../../../src/helpers/numbers');

describe('toString', () => {
  it('should return a string', async () => {
    const result = NumbersHelper.toString(0.1);

    expect(result).toEqual('0.1');
  });
});

describe('toNumber', () => {
  it('should return a number', async () => {
    const result = NumbersHelper.toNumber('0.1');

    expect(result).toEqual(0.1);
  });
});

describe('toFixedToFloat', () => {
  it('should round BN', () => {
    const result = NumbersHelper.toFixedToFloat(BigNumber(1.234567));

    expect(result).toEqual(1.23);
  });

  it('should round BN up', () => {
    const result = NumbersHelper.toFixedToFloat(BigNumber(1.23987));

    expect(result).toEqual(1.24);
  });
});

describe('oldMultiply', () => {
  it('should multiply numbers', async () => {
    const result = NumbersHelper.oldMultiply(0.1, 2, 0.2);

    expect(result).toEqual(0.04);
  });
});

describe('multiply', () => {
  it('should multiply number', () => {
    const result = NumbersHelper.multiply(0.1, 2, 0.2);

    expect(result).toEqual('0.04');
  });
});

describe('oldDivide', () => {
  it('should divide numbers', async () => {
    const result = NumbersHelper.oldDivide(0.3, 0.2);

    expect(result).toEqual(1.5);
  });
});

describe('divide', () => {
  it('should divide numbers', async () => {
    const result = NumbersHelper.divide(0.3, 0.2);

    expect(result).toEqual('1.5');
  });
});

describe('oldAdd', () => {
  it('should add numbers', async () => {
    const result = NumbersHelper.oldAdd(0.6, 0.3, 1.2);

    expect(result).toEqual(2.1);
  });
});

describe('add', () => {
  it('should add numbers', async () => {
    const result = NumbersHelper.add(0.6, 0.3, 1.2);

    expect(result).toEqual('2.1');
  });
});

describe('oldSubtract', () => {
  it('should subtract numbers', async () => {
    const result = NumbersHelper.oldSubtract(0.7, 0.2);

    expect(result).toEqual(0.5);
  });
});

describe('subtract', () => {
  it('should subtract numbers', async () => {
    const result = NumbersHelper.subtract(0.7, 0.2);

    expect(result).toEqual('0.5');
  });
});

describe('isGreaterThan', () => {
  it('should return true', async () => {
    const result = NumbersHelper.isGreaterThan(0.7, 0.2);

    expect(result).toBeTruthy();
  });

  it('should return false if less', async () => {
    const result = NumbersHelper.isGreaterThan(0.7, 1.2);

    expect(result).toBeFalsy();
  });

  it('should return false if equal', async () => {
    const result = NumbersHelper.isGreaterThan(0.7, 0.7);

    expect(result).toBeFalsy();
  });
});

describe('isLessThan', () => {
  it('should return true', async () => {
    const result = NumbersHelper.isLessThan(0.2, 0.7);

    expect(result).toBeTruthy();
  });

  it('should return false if greater', async () => {
    const result = NumbersHelper.isLessThan(1.7, 1.2);

    expect(result).toBeFalsy();
  });

  it('should return false if equal', async () => {
    const result = NumbersHelper.isLessThan(1.7, 1.7);

    expect(result).toBeFalsy();
  });
});

describe('isEqualTo', () => {
  it('should return true', () => {
    const result = NumbersHelper.isEqualTo(1.23, 1.23);

    expect(result).toBeTruthy();
  });

  it('should return false', () => {
    const result = NumbersHelper.isEqualTo(1.23, 2.45);

    expect(result).toBeFalsy();
  });
});
