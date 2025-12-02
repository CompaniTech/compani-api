const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const Category = require('../../src/models/Category');
const app = require('../../server');
const { populateDB, categoriesList } = require('./seed/categoriesSeed');
const { getToken } = require('./helpers/authentication');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('CATEGORIES ROUTES - POST /categories', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should create a category', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { name: 'ma nouvelle catégorie' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 409 if name is already taken', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { name: 'ce nom de catégorie est déja pris!' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 400 if there is no name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/categories',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
          payload: { name: `ma nouvelle catégorie en tant que ${role.name}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('CATEGORIES ROUTES - GET /categories', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should get all categories', async () => {
      const categoriesNumber = categoriesList.length;
      const response = await app.inject({
        method: 'GET',
        url: '/categories',
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.result.data.categories.length).toEqual(categoriesNumber);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'GET',
          url: '/categories',
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('CATEGORIES ROUTES - PUT /categories/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should update category name', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/categories/${categoriesList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { name: 'nouveau nom' },
      });

      expect(response.statusCode).toBe(200);

      const categoryUpdated = await Category.countDocuments({ _id: categoriesList[0]._id, name: 'nouveau nom' });
      expect(categoryUpdated).toEqual(1);
    });

    it('should return 404 if category does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/categories/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { name: 'nouveau nom' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if new name is already taken', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/categories/${categoriesList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        payload: { name: 'ce nom de catégorie est déja pris!' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          payload: { name: `mon nouveau nom de catégorie en tant que ${role.name}` },
          url: `/categories/${categoriesList[0]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('CATEGORIES ROUTES - DELETE /categories/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('TRAINING_ORGANISATION_MANAGER', () => {
    beforeEach(async () => {
      authToken = await getToken('training_organisation_manager');
    });

    it('should delete category', async () => {
      const categoriesCount = await Category.countDocuments();
      const response = await app.inject({
        method: 'DELETE',
        url: `/categories/${categoriesList[0]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(await Category.countDocuments()).toEqual(categoriesCount - 1);
    });

    it('should return a 403 if category is used', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/categories/${categoriesList[4]._id}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return a 404 if category does not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/categories/${new ObjectId()}`,
        headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'planning_referent', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/categories/${categoriesList[0]._id}`,
          headers: { Cookie: `${process.env.ALENVI_TOKEN}=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
