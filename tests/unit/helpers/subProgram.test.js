const sinon = require('sinon');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const Program = require('../../../src/models/Program');
const SubProgram = require('../../../src/models/SubProgram');
const SubProgramHelper = require('../../../src/helpers/subPrograms');
require('sinon-mongoose');

describe('addSubProgram', () => {
  let ProgramMock;
  let SubProgramMock;

  beforeEach(() => {
    ProgramMock = sinon.mock(Program);
    SubProgramMock = sinon.mock(SubProgram);
  });

  afterEach(() => {
    ProgramMock.restore();
    SubProgramMock.restore();
  });

  const program = { _id: new ObjectID() };
  const newSubProgram = { name: 'nouveau sous programme' };
  it('should create a subProgram', async () => {
    const subProgramId = new ObjectID();
    ProgramMock.expects('countDocuments').withExactArgs({ _id: program._id }).returns(1);

    SubProgramMock.expects('create').withExactArgs(newSubProgram).returns({ _id: subProgramId });

    ProgramMock.expects('updateOne').withExactArgs({ _id: program._id }, { $push: { subPrograms: subProgramId } });

    await SubProgramHelper.addSubProgram(program._id, newSubProgram);

    ProgramMock.verify();
    SubProgramMock.verify();
  });

  it('should return an error if program does not exist', async () => {
    try {
      ProgramMock.expects('countDocuments').withExactArgs({ _id: program._id }).returns(0);

      SubProgramMock.expects('create').never();
      ProgramMock.expects('updateOne').never();

      await SubProgramHelper.addSubProgram(program._id, newSubProgram);
    } catch (e) {
      ProgramMock.verify();
      SubProgramMock.verify();
    }
  });
});

describe('updatedSubProgram', () => {
  let SubProgramMock;

  beforeEach(() => {
    SubProgramMock = sinon.mock(SubProgram);
  });

  afterEach(() => {
    SubProgramMock.restore();
  });

  it('should update a subProgram name', async () => {
    const subProgram = { _id: new ObjectID(), name: 'non' };
    const payload = { name: 'si' };
    const updatedSubProgram = { ...subProgram, ...payload };

    SubProgramMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: subProgram._id }, { $set: payload }, { new: true })
      .chain('lean')
      .once()
      .returns(updatedSubProgram);

    const result = await SubProgramHelper.updateSubProgram(subProgram._id, payload);

    expect(result).toMatchObject(updatedSubProgram);
    SubProgramMock.verify();
  });
});
