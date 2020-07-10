const expect = require('expect');
const GetStream = require('get-stream');
const { ObjectID } = require('mongodb');
const sinon = require('sinon');
const omit = require('lodash/omit');
const pick = require('lodash/pick');
const app = require('../../server');
const Program = require('../../src/models/Program');
const CloudinaryHelper = require('../../src/helpers/cloudinary');
const { populateDB, programsList } = require('./seed/programsSeed');
const { getToken } = require('./seed/authenticationSeed');
const { generateFormData } = require('./utils');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('PROGRAMS ROUTES - POST /programs', () => {
  let token;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      token = await getToken('vendor_admin');
    });

    it('should create program', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/programs',
        headers: { 'x-access-token': token },
        payload: { name: 'program' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        token = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/programs',
          headers: { 'x-access-token': token },
          payload: { name: 'program' },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PROGRAMS ROUTES - GET /programs', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should get all programs', async () => {
      const programsNumber = programsList.length;
      const response = await app.inject({
        method: 'GET',
        url: '/programs',
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.programs.length).toEqual(programsNumber);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/programs',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PROGRAMS ROUTES - GET /programs/{_id}', () => {
  let authToken = null;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should get program', async () => {
      const programId = programsList[0]._id;
      const response = await app.inject({
        method: 'GET',
        url: `/programs/${programId.toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.program).toMatchObject({
        _id: programId,
        name: 'program',
        modules: [
          {
            title: 'c\'est un module',
            activities: [{ title: 'c\'est une activité' }, { title: 'toujours une activité' }],
          },
          { title: 'toujours un module' },
        ],
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const programId = programsList[0]._id;
        const response = await app.inject({
          method: 'GET',
          url: `/programs/${programId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PROGRAMS ROUTES - PUT /programs/{_id}', () => {
  let authToken = null;
  beforeEach(populateDB);
  const payload = { name: 'new name', learningGoals: 'On apprend des trucs\nc\'est chouette' };

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should update program', async () => {
      const programId = programsList[0]._id;
      const response = await app.inject({
        method: 'PUT',
        url: `/programs/${programId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      const programUpdated = await Program.findById(programId);

      expect(response.statusCode).toBe(200);
      expect(programUpdated._id).toEqual(programId);
      expect(programUpdated.name).toEqual('new name');
      expect(programUpdated.learningGoals).toEqual('On apprend des trucs\nc\'est chouette');
    });

    const falsyParams = ['name', 'learningGoals'];
    falsyParams.forEach((param) => {
      it(`should return a 400 if ${param} is equal to '' `, async () => {
        const programId = programsList[0]._id;
        const response = await app.inject({
          method: 'PUT',
          url: `/programs/${programId.toHexString()}`,
          payload: { ...payload, [param]: '' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const programId = programsList[0]._id;
        const response = await app.inject({
          method: 'PUT',
          payload: { name: 'new name' },
          url: `/programs/${programId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('PROGRAMS ROUTES - POST /programs/{_id}/module', () => {
  let authToken = null;
  beforeEach(populateDB);
  const payload = { title: 'new module' };

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should create module', async () => {
      const programId = programsList[0]._id;
      const modulesLengthBefore = programsList[0].modules.length;
      const response = await app.inject({
        method: 'POST',
        url: `/programs/${programId.toHexString()}/module`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      const programUpdated = await Program.findById(programId);

      expect(response.statusCode).toBe(200);
      expect(programUpdated._id).toEqual(programId);
      expect(programUpdated.modules.length).toEqual(modulesLengthBefore + 1);
    });

    it('should return a 400 if missing title', async () => {
      const programId = programsList[0]._id;
      const response = await app.inject({
        method: 'POST',
        url: `/programs/${programId.toHexString()}/module`,
        payload: { },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if program does not exist', async () => {
      const wrongId = new ObjectID();
      const response = await app.inject({
        method: 'POST',
        url: `/programs/${wrongId}/module`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const programId = programsList[0]._id;
        const response = await app.inject({
          method: 'POST',
          payload: { title: 'new name' },
          url: `/programs/${programId.toHexString()}/module`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('POST /programs/:id/cloudinary/upload', () => {
  let authToken;
  let docPayload;
  let form;
  let addImageStub;
  const program = programsList[0];
  beforeEach(() => {
    docPayload = { fileName: 'program_image_test', file: 'true' };
    form = generateFormData(docPayload);
    addImageStub = sinon.stub(CloudinaryHelper, 'addImage')
      .returns({ public_id: 'abcdefgh', secure_url: 'https://alenvi.io' });
  });
  afterEach(() => {
    addImageStub.restore();
  });

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should add a program image', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/programs/${program._id}/cloudinary/upload`,
        payload: await GetStream(form),
        headers: { ...form.getHeaders(), 'x-access-token': authToken },
      });

      const programWithImage = { ...program, image: { publicId: 'abcdefgh', link: 'https://alenvi.io' } };
      const programUpdated = await Program.findById(program._id, { name: 1, image: 1 }).lean();

      expect(response.statusCode).toBe(200);
      expect(programUpdated).toMatchObject(pick(programWithImage, ['_id', 'name', 'image']));
      sinon.assert.calledOnce(addImageStub);
    });

    const wrongParams = ['file', 'fileName'];
    wrongParams.forEach((param) => {
      it(`should return a 400 error if missing '${param}' parameter`, async () => {
        form = generateFormData(omit(docPayload, param));
        const response = await app.inject({
          method: 'POST',
          url: `/programs/${program._id}/cloudinary/upload`,
          payload: await GetStream(form),
          headers: { ...form.getHeaders(), 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: `/programs/${program._id}/cloudinary/upload`,
          payload: await GetStream(form),
          headers: { ...form.getHeaders(), 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
