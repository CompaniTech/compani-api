const sinon = require('sinon');
const { expect } = require('expect');
const path = require('path');
const os = require('os');
const DriveHelper = require('../../../src/helpers/drive');
const Drive = require('../../../src/models/Google/Drive');

describe('downloadFile', () => {
  it('should download a file on drive', async () => {
    const downloadFileByIdStub = sinon.stub(Drive, 'downloadFileById');
    downloadFileByIdStub.returns({ type: 'application/pdf' });
    const filePath = path.join(os.tmpdir(), 'download');
    const driveId = '1234567890';

    const result = await DriveHelper.downloadFile(driveId);

    expect(result).toEqual({ filePath, type: 'application/pdf' });
    sinon.assert.calledWithExactly(downloadFileByIdStub, { fileId: driveId, tmpFilePath: filePath });
    downloadFileByIdStub.restore();
  });
});
