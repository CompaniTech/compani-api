const expect = require('expect');
const { ObjectID } = require('mongodb');
const moment = require('moment');
const qs = require('qs');
const omit = require('lodash/omit');
const {
  populateDB,
  eventsList,
  auxiliaries,
  customerAuxiliary,
  sectors,
  thirdPartyPayer,
  helpersCustomer,
  getUserToken,
  internalHour,
  customerFromOtherCompany,
  auxiliaryFromOtherCompany,
  internalHourFromOtherCompany,
  thirdPartyPayerFromOtherCompany,
} = require('./seed/eventsSeed');
const { getToken, authCompany } = require('./seed/authenticationSeed');
const app = require('../../server');
const {
  INTERVENTION,
  ABSENCE,
  UNAVAILABILITY,
  INTERNAL_HOUR,
  ILLNESS,
  DAILY,
  EVERY_DAY,
} = require('../../src/helpers/constants');
const Repetition = require('../../src/models/Repetition');
const Event = require('../../src/models/Event');

describe('NODE ENV', () => {
  it('should be "test"', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('EVENTS ROUTES', () => {
  let authToken = null;

  describe('GET /events', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });
      it('should return all events', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toBeDefined();
        expect(response.result.data.events.length).toEqual(eventsList.length);
      });

      it('should return a list of events', async () => {
        const startDate = moment('2019-01-18');
        const endDate = moment('2019-01-20');
        const response = await app.inject({
          method: 'GET',
          url: `/events?startDate=${startDate.toDate()}&endDate=${endDate.toDate()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toBeDefined();
        response.result.data.events.forEach((event) => {
          expect(moment(event.startDate).isSameOrAfter(startDate)).toBeTruthy();
          expect(moment(event.startDate).isSameOrBefore(endDate)).toBeTruthy();
          if (event.type === 'intervention') {
            expect(event.subscription._id).toBeDefined();
          }
        });
      });

      it('should return a list of events groupedBy customers', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events?groupBy=customer&type=intervention',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toBeDefined();
        expect(response.result.data.events[0]._id).toBeDefined();
        expect(response.result.data.events[0].events).toBeDefined();
        response.result.data.events[0].events.forEach((event) => {
          expect(event.customer._id).toEqual(response.result.data.events[0]._id);
        });
      });

      it('should return a list of events groupedBy auxiliaries', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events?groupBy=auxiliary',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toBeDefined();
        expect(response.result.data.events[0]._id).toBeDefined();
        expect(response.result.data.events[0].events).toBeDefined();
        const index = response.result.data.events.findIndex(event => event.events[0].auxiliary);
        response.result.data.events[index].events.forEach((event) => {
          expect(event.auxiliary._id).toEqual(response.result.data.events[index]._id);
        });
      });

      it('should return an empty list as no event is matching the request', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events?startDate=20000101&endDate=20001010',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toEqual([]);
      });

      it('should return a 403 if customer is not from the same company', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events?customer=${customerFromOtherCompany._id}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 403 if auxiliary is not from the same company', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events?auxiliary=${auxiliaryFromOtherCompany._id}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 403 if sector is not from the same company', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events?sector=${sectors[2]._id}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const roles = [
        { name: 'helper', expectedCode: 403 },
        {
          name: 'helper\'s customer',
          expectedCode: 200,
          url: `/events?customer=${customerAuxiliary._id.toHexString()}`,
          customCredentials: { ...helpersCustomer.local },
        },
        { name: 'auxiliary', expectedCode: 200 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
        { name: 'planningReferent', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'GET',
            url: role.url || '/events',
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /events/credit-notes', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });

      it('should return a list of billed events for specified customer', async () => {
        const query = {
          startDate: moment('2019-01-01').toDate(),
          endDate: moment('2019-01-20').toDate(),
          customer: customerAuxiliary._id.toHexString(),
          isBilled: true,
        };

        const response = await app.inject({
          method: 'GET',
          url: `/events/credit-notes?${qs.stringify(query)}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toBeDefined();
        const filteredEvents = eventsList.filter(ev => ev.isBilled && !ev.bills.inclTaxesTpp);
        expect(response.result.data.events.length).toBe(filteredEvents.length);
      });

      it('should return a list of billed events for specified customer and tpp', async () => {
        const query = {
          startDate: moment('2019-01-01').toDate(),
          endDate: moment('2019-01-20').toDate(),
          customer: customerAuxiliary._id.toHexString(),
          thirdPartyPayer: thirdPartyPayer._id.toHexString(),
          isBilled: true,
        };

        const response = await app.inject({
          method: 'GET',
          url: `/events/credit-notes?${qs.stringify(query)}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toBeDefined();
        const filteredEvents = eventsList.filter(ev => ev.isBilled && ev.bills.inclTaxesTpp);
        expect(response.result.data.events.length).toBe(filteredEvents.length);
      });

      it('should return an empty list as no event is matching the request', async () => {
        const query = {
          startDate: moment('2017-01-01').toDate(),
          endDate: moment('2017-01-20').toDate(),
          customer: customerAuxiliary._id.toHexString(),
          isBilled: true,
        };

        const response = await app.inject({
          method: 'GET',
          url: `/events/credit-notes?${qs.stringify(query)}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.events).toEqual([]);
      });

      const wrongParams = ['startDate', 'endDate', 'customer', 'isBilled'];
      wrongParams.forEach((param) => {
        it(`should return a 400 error if missing '${param}' parameter`, async () => {
          const query = {
            startDate: moment('2019-01-01').toDate(),
            endDate: moment('2019-01-20').toDate(),
            customer: customerAuxiliary._id.toHexString(),
            isBilled: true,
          };
          const wrongQuery = omit(query, param);

          const response = await app.inject({
            method: 'GET',
            url: `/events/credit-notes?${qs.stringify(wrongQuery)}`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(400);
        });
      });

      it('should return a 403 if customer is not from the same company', async () => {
        const query = {
          startDate: moment('2019-01-01').toDate(),
          endDate: moment('2019-01-20').toDate(),
          customer: customerFromOtherCompany._id.toHexString(),
          thirdPartyPayer: thirdPartyPayer._id.toHexString(),
          isBilled: true,
        };

        const response = await app.inject({
          method: 'GET',
          url: `/events/credit-notes?${qs.stringify(query)}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 403 if tpp is not from the same company', async () => {
        const query = {
          startDate: moment('2019-01-01').toDate(),
          endDate: moment('2019-01-20').toDate(),
          customer: customerAuxiliary._id.toHexString(),
          thirdPartyPayer: thirdPartyPayerFromOtherCompany._id.toHexString(),
          isBilled: true,
        };

        const response = await app.inject({
          method: 'GET',
          url: `/events/credit-notes?${qs.stringify(query)}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 200 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
        { name: 'planningReferent', expectedCode: 200 },
      ];
      const query = {
        startDate: moment('2019-01-01').toDate(),
        endDate: moment('2019-01-20').toDate(),
        customer: customerAuxiliary._id.toHexString(),
        isBilled: true,
      };

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name);

          const response = await app.inject({
            method: 'GET',
            url: `/events/credit-notes?${qs.stringify(query)}`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /events/working-stats', () => {
    const startDate = moment('2019-01-18').toDate();
    const endDate = moment('2019-01-20').toDate();
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });

      it('should return working stats for an auxiliary', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/working-stats?auxiliary=${auxiliaries[0]._id}&startDate=${startDate}&endDate=${endDate}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.workingStats).toBeDefined();
      });

      it('should return working stats for auxiliaries', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/working-stats?auxiliary=${auxiliaries[0]._id}&startDate=${startDate}&endDate=${endDate}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
      });

      it('should return working stats for all auxiliaries', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/working-stats?startDate=${startDate}&endDate=${endDate}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
      });

      it('should return a 403 if auxiliary is not from the same company', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/working-stats?auxiliary=${auxiliaryFromOtherCompany._id}&startDate=${startDate}
            &endDate=${endDate}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 200 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
        { name: 'planningReferent', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'GET',
            url: `/events/working-stats?auxiliary=${auxiliaries[0]._id}&startDate=${startDate}&endDate=${endDate}`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /events/paid-transport', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });

      it('should return paid transport stats for a sector', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/paid-transport?sector=${sectors[0]._id}&month=01-2020`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.paidTransportStatsBySector).toBeDefined();
        expect(response.result.data.paidTransportStatsBySector[0].duration).toEqual(1);
      });

      it('should return paid transport stats for many sectors', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/paid-transport?sector=${sectors[0]._id}&sector=${sectors[1]._id}&month=01-2020`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        const resultForFirstSector = response.result.data.paidTransportStatsBySector.find(res =>
          res.sector.toHexString() === sectors[0]._id.toHexString());
        expect(resultForFirstSector.duration).toEqual(1);

        const resultForSecondSector = response.result.data.paidTransportStatsBySector.find(res =>
          res.sector.toHexString() === sectors[1]._id.toHexString());
        expect(resultForSecondSector.duration).toEqual(0.75);
      });

      it('should return a 403 if sector is not from the same company', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/paid-transport?sector=${sectors[2]._id}&month=01-2020`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 400 if missing sector', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events/paid-transport?month=01-2020',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });

      it('should return a 400 if missing month', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/paid-transport?sector=${sectors[0]._id}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });

      it('should return a 400 if month does not correspond to regex', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events/paid-transport?month=012020',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 200 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
        { name: 'planningReferent', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'GET',
            url: `/events/paid-transport?sector=${sectors[0]._id}&month=01-2020`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /events/unassigned-hours', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });

      it('should return unassigned hours for a sector', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/unassigned-hours?sector=${sectors[0]._id}&month=01-2020`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.unassignedHoursBySector[0].duration).toEqual(5);
      });

      it('should return an empty array if sector does not have unassigned event', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/unassigned-hours?sector=${sectors[0]._id}&month=02-2020`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.unassignedHoursBySector.length).toEqual(0);
      });

      it('should return unassigned hours for many sectors', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/unassigned-hours?sector=${sectors[0]._id}&sector=${sectors[1]._id}&month=01-2020`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        const firstSectorResult = response.result.data.unassignedHoursBySector.find(el =>
          el.sector.toHexString() === sectors[0]._id.toHexString());
        expect(firstSectorResult.duration).toEqual(5);

        const secondSectorResult = response.result.data.unassignedHoursBySector.find(el =>
          el.sector.toHexString() === sectors[1]._id.toHexString());
        expect(secondSectorResult.duration).toEqual(1.5);
      });

      it('should return a 403 if sector is not from the same company', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/unassigned-hours?sector=${sectors[2]._id}&month=01-2020`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 400 if missing sector', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events/unassigned-hours?month=01-2020',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });

      it('should return a 400 if missing month', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/events/unassigned-hours?sector=${sectors[0]._id}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });

      it('should return a 400 if month does not correspond to regex', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/events/unassigned-hours?month=012020',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 200 },
        { name: 'coach', expectedCode: 200 },
        { name: 'planningReferent', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'GET',
            url: `/events/unassigned-hours?sector=${sectors[0]._id}&month=01-2020`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('POST /events', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });
      it('should create an internal hour', async () => {
        const payload = {
          type: INTERNAL_HOUR,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaries[0]._id.toHexString(),
          internalHour: internalHour._id,
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.event).toBeDefined();
      });

      it('should create an intervention with auxiliary', async () => {
        const payload = {
          type: INTERVENTION,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaries[0]._id.toHexString(),
          customer: customerAuxiliary._id.toHexString(),
          subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
          status: 'contract_with_company',
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.event).toBeDefined();
      });

      it('should create an intervention with sector', async () => {
        const payload = {
          type: INTERVENTION,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          sector: sectors[0]._id.toHexString(),
          customer: customerAuxiliary._id.toHexString(),
          subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
          status: 'contract_with_company',
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.event).toBeDefined();
      });

      it('should create an absence', async () => {
        const auxiliary = auxiliaries[0];
        const payload = {
          type: ABSENCE,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliary._id.toHexString(),
          absence: ILLNESS,
          absenceNature: DAILY,
          attachment: { driveId: 'qwertyuiop', link: 'asdfghjkl;' },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.event).toBeDefined();
      });

      it('should create an unavailability', async () => {
        const payload = {
          type: UNAVAILABILITY,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaries[0]._id,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.event).toBeDefined();
      });

      it('should create a repetition', async () => {
        const payload = {
          type: INTERVENTION,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaries[0]._id.toHexString(),
          customer: customerAuxiliary._id.toHexString(),
          subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
          status: 'contract_with_company',
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
          repetition: { frequency: EVERY_DAY },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.result.data.event).toBeDefined();
        const repeatedEventsCount = await Event.countDocuments({
          'repetition.parentId': response.result.data.event._id,
          company: authCompany._id,
        }).lean();
        expect(repeatedEventsCount).toEqual(91);
        const repetition = await Repetition.findOne({ parentId: response.result.data.event._id }).lean();
        expect(repetition).toBeDefined();
      });

      const baseInterventionPayload = {
        type: INTERVENTION,
        startDate: '2019-01-23T10:00:00.000+01:00',
        endDate: '2019-01-23T12:30:00.000+01:00',
        auxiliary: auxiliaries[0]._id.toHexString(),
        customer: customerAuxiliary._id.toHexString(),
        subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
        status: 'contract_with_company',
        address: {
          fullAddress: '4 rue du test 92160 Antony',
          street: '4 rue du test',
          zipCode: '92160',
          city: 'Antony',
          location: { type: 'Point', coordinates: [2.377133, 48.801389] },
        },
      };
      const interventionMissingParams = [
        { payload: { ...omit(baseInterventionPayload, 'address') }, reason: 'missing address' },
        { payload: { ...omit(baseInterventionPayload, 'address.fullAddress') }, reason: 'missing address.fullAddress' },
        { payload: { ...omit(baseInterventionPayload, 'address.street') }, reason: 'missing address.street' },
        { payload: { ...omit(baseInterventionPayload, 'address.zipCode') }, reason: 'missing address.zipCode' },
        { payload: { ...omit(baseInterventionPayload, 'address.city') }, reason: 'missing address.city' },
        { payload: { ...omit(baseInterventionPayload, 'address.location') }, reason: 'missing address.location' },
        {
          payload: { ...omit(baseInterventionPayload, 'address.location.coordinates') },
          reason: 'missing address.location.coordinates',
        },
        {
          payload: { ...omit(baseInterventionPayload, 'address.location.type') },
          reason: 'missing address.location.type',
        },
        { payload: { ...omit(baseInterventionPayload, 'customer') }, reason: 'missing customer' },
        { payload: { ...omit(baseInterventionPayload, 'subscription') }, reason: 'missing subscription' },
        { payload: { ...omit(baseInterventionPayload, 'status') }, reason: 'missing status' },
        { payload: { ...omit(baseInterventionPayload, 'type') }, reason: 'missing type' },
        { payload: { ...omit(baseInterventionPayload, 'startDate') }, reason: 'missing startDate' },
        { payload: { ...omit(baseInterventionPayload, 'endDate') }, reason: 'missing endDate' },
      ];
      interventionMissingParams.forEach((test) => {
        it(`should return a 400 error as intervention payload is invalid: ${test.reason}`, async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/events',
            payload: test.payload,
            headers: { 'x-access-token': authToken },
          });
          expect(response.statusCode).toEqual(400);
        });
      });

      const baseInternalHourPayload = {
        type: INTERNAL_HOUR,
        startDate: '2019-01-23T10:00:00.000+01:00',
        endDate: '2019-01-23T12:30:00.000+01:00',
        auxiliary: auxiliaries[0]._id.toHexString(),
        internalHour: internalHour._id,
      };
      const internalHourMissingParams = [
        { payload: { ...omit(baseInternalHourPayload, 'internalHour') }, reason: 'missing internalHour' },
        { payload: { ...omit(baseInternalHourPayload, 'startDate') }, reason: 'missing startDate' },
        { payload: { ...omit(baseInternalHourPayload, 'endDate') }, reason: 'missing endDate' },
        { payload: { ...omit(baseInternalHourPayload, 'auxiliary') }, reason: 'missing auxiliary' },
      ];
      internalHourMissingParams.forEach((test) => {
        it(`should return a 400 error as internal hour payload is invalid: ${test.reason}`, async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/events',
            payload: test.payload,
            headers: { 'x-access-token': authToken },
          });
          expect(response.statusCode).toEqual(400);
        });
      });

      const baseAbsencePayload = {
        type: ABSENCE,
        startDate: '2019-01-23T10:00:00.000+01:00',
        endDate: '2019-01-23T12:30:00.000+01:00',
        auxiliary: auxiliaries[0]._id.toHexString(),
        absence: ILLNESS,
        absenceNature: DAILY,
        attachment: { driveId: 'qwertyuiop', link: 'asdfghjkl;' },
      };
      const absenceMissingParams = [
        { payload: { ...omit(baseAbsencePayload, 'absence') }, reason: 'missing absence' },
        { payload: { ...omit(baseAbsencePayload, 'absenceNature') }, reason: 'missing absenceNature' },
        { payload: { ...omit(baseAbsencePayload, 'startDate') }, reason: 'missing startDate' },
        { payload: { ...omit(baseAbsencePayload, 'endDate') }, reason: 'missing endDate' },
        { payload: { ...omit(baseAbsencePayload, 'auxiliary') }, reason: 'missing auxiliary' },
        { payload: { ...omit(baseAbsencePayload, 'attachment') }, reason: 'missing attachment on illness' },
      ];
      absenceMissingParams.forEach((test) => {
        it(`should return a 400 error as absence payload is invalid: ${test.reason}`, async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/events',
            payload: test.payload,
            headers: { 'x-access-token': authToken },
          });
          expect(response.statusCode).toEqual(400);
        });
      });

      const baseUnavailabilityPayload = {
        type: UNAVAILABILITY,
        startDate: '2019-01-23T10:00:00.000+01:00',
        endDate: '2019-01-23T12:30:00.000+01:00',
        auxiliary: auxiliaries[0]._id.toHexString(),
      };
      const unavailabilityMissingParams = [
        { payload: { ...omit(baseUnavailabilityPayload, 'startDate') }, reason: 'missing startDate' },
        { payload: { ...omit(baseUnavailabilityPayload, 'endDate') }, reason: 'missing endDate' },
        { payload: { ...omit(baseUnavailabilityPayload, 'auxiliary') }, reason: 'missing auxiliary' },
      ];
      unavailabilityMissingParams.forEach((test) => {
        it(`should return a 400 error as unavailability payload is invalid: ${test.reason}`, async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/events',
            payload: test.payload,
            headers: { 'x-access-token': authToken },
          });
          expect(response.statusCode).toEqual(400);
        });
      });

      it('should return a 400 error as payload contains auxiliary and sector', async () => {
        const payload = {
          type: 'intervention',
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: '5c0002a5086ec30013f7f436',
          customer: '5c35b5eb1a6fb00997363eeb',
          subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
          sector: sectors[0]._id.toHexString(),
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });
        expect(response.statusCode).toEqual(400);
      });

      it('should return a 403 if customer is not from the same company', async () => {
        const payload = {
          type: INTERVENTION,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaries[0]._id.toHexString(),
          customer: customerFromOtherCompany._id.toHexString(),
          subscription: customerFromOtherCompany.subscriptions[0]._id.toHexString(),
          status: 'contract_with_company',
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 403 if the subscription is not for the customer', async () => {
        const payload = {
          type: INTERVENTION,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaries[0]._id.toHexString(),
          customer: customerAuxiliary._id.toHexString(),
          subscription: customerFromOtherCompany.subscriptions[0]._id.toHexString(),
          status: 'contract_with_company',
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 403 if auxiliary is not from the same company', async () => {
        const payload = {
          type: INTERVENTION,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaryFromOtherCompany._id.toHexString(),
          customer: customerAuxiliary._id.toHexString(),
          subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
          status: 'contract_with_company',
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 403 if internalHour is not from the same company', async () => {
        const payload = {
          type: INTERNAL_HOUR,
          internalHour: internalHourFromOtherCompany._id,
          startDate: '2019-01-23T10:00:00.000+01:00',
          endDate: '2019-01-23T12:30:00.000+01:00',
          auxiliary: auxiliaries[0]._id.toHexString(),
          subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
          status: 'contract_with_company',
          address: {
            fullAddress: '4 rue du test 92160 Antony',
            street: '4 rue du test',
            zipCode: '92160',
            city: 'Antony',
            location: { type: 'Point', coordinates: [2.377133, 48.801389] },
          },
        };

        const response = await app.inject({
          method: 'POST',
          url: '/events',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const payload = {
        type: INTERVENTION,
        startDate: '2019-01-23T10:00:00.000+01:00',
        endDate: '2019-01-23T12:30:00.000+01:00',
        auxiliary: auxiliaries[0]._id.toHexString(),
        customer: customerAuxiliary._id.toHexString(),
        subscription: customerAuxiliary.subscriptions[0]._id.toHexString(),
        status: 'contract_with_company',
        address: {
          fullAddress: '4 rue du test 92160 Antony',
          street: '4 rue du test',
          zipCode: '92160',
          city: 'Antony',
          location: { type: 'Point', coordinates: [2.377133, 48.801389] },
        },
      };

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'planningReferent', expectedCode: 200 },
        {
          name: 'auxiliary event',
          expectedCode: 200,
          customCredentials: auxiliaries[0].local,
        },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'POST',
            url: '/events',
            payload,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('PUT /events/{_id}', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });

      it('should update corresponding event with sector', async () => {
        const event = eventsList[2];
        const payload = {
          startDate: '2019-01-23T10:00:00.000Z',
          endDate: '2019-01-23T12:00:00.000Z',
          sector: sectors[0]._id.toHexString(),
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.event).toBeDefined();
        expect(response.result.data.event._id).toEqual(event._id);
        expect(moment(response.result.data.event.startDate).isSame(moment(payload.startDate))).toBeTruthy();
        expect(moment(response.result.data.event.endDate).isSame(moment(payload.endDate))).toBeTruthy();
      });

      it('should update corresponding event with auxiliary', async () => {
        const event = eventsList[0];
        const payload = {
          startDate: '2019-01-23T10:00:00.000Z',
          endDate: '2019-01-23T12:00:00.000Z',
          auxiliary: event.auxiliary.toHexString(),
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.event).toBeDefined();
        expect(response.result.data.event._id).toEqual(event._id);
        expect(moment(response.result.data.event.startDate).isSame(moment(payload.startDate))).toBeTruthy();
        expect(moment(response.result.data.event.endDate).isSame(moment(payload.endDate))).toBeTruthy();
      });

      it('should update internalhour if address is {}', async () => {
        const event = eventsList[0];
        const payload = { auxiliary: event.auxiliary.toHexString(), address: {} };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.event.address).toBeUndefined();
      });

      it('should return a 400 if event is not an internal hours and adress is {}', async () => {
        const event = eventsList[2];
        const payload = { address: {} };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error as payload is invalid', async () => {
        const payload = { beginDate: '2019-01-23T10:00:00.000Z', sector: new ObjectID() };
        const event = eventsList[0];

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error as startDate and endDate are not on the same day', async () => {
        const payload = {
          startDate: '2019-01-23T10:00:00.000Z',
          endDate: '2019-02-23T12:00:00.000Z',
          sector: sectors[0]._id.toHexString(),
        };
        const event = eventsList[0];

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 403 if auxiliary is not from the same company', async () => {
        const event = eventsList[0];
        const payload = {
          startDate: '2019-01-23T10:00:00.000Z',
          endDate: '2019-02-23T12:00:00.000Z',
          auxiliary: auxiliaryFromOtherCompany._id.toHexString(),
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return a 404 error as event is not found', async () => {
        const payload = {
          startDate: '2019-01-23T10:00:00.000Z',
          endDate: '2019-02-23T12:00:00.000Z',
          sector: sectors[0]._id.toHexString(),
        };
        const invalidId = new ObjectID();

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${invalidId.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return a 403 if the subscription is not for the customer', async () => {
        const event = eventsList[0];
        const payload = {
          sector: sectors[0]._id.toHexString(),
          subscription: customerFromOtherCompany.subscriptions[0]._id.toHexString(),
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 400 if auxiliary sector and auxiliary are in the payload', async () => {
        const event = eventsList[0];
        const payload = {
          sector: sectors[0]._id.toHexString(),
          auxiliary: auxiliaryFromOtherCompany._id.toHexString(),
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });

      it('should return a 400 if both auxiliary sector and auxiliary are missing', async () => {
        const event = eventsList[0];
        const payload = { subscription: customerFromOtherCompany.subscriptions[0]._id.toHexString() };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(400);
      });

      it('should return a 403 if internalHour is not from the same company', async () => {
        const event = eventsList[0];
        const payload = {
          sector: sectors[0]._id.toHexString(),
          internalHour: internalHourFromOtherCompany._id,
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('should return a 403 if sector is not from the same company', async () => {
        const event = eventsList[0];
        const payload = {
          sector: sectors[2]._id.toHexString(),
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/events/${event._id.toHexString()}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toEqual(403);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const payload = {
        startDate: '2019-01-23T10:00:00.000Z',
        endDate: '2019-01-23T12:00:00.000Z',
        sector: sectors[0]._id.toHexString(),
      };

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'planningReferent', expectedCode: 200 },
        {
          name: 'auxiliary event',
          expectedCode: 200,
          customCredentials: auxiliaries[0].local,
        },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'PUT',
            url: `/events/${eventsList[2]._id.toHexString()}`,
            payload,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('DELETE /events/{_id}', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });

      it('should delete corresponding event', async () => {
        const event = eventsList[0];

        const response = await app.inject({
          method: 'DELETE',
          url: `/events/${event._id.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });
        expect(response.statusCode).toBe(200);
      });

      it('should return a 404 error as event is not found', async () => {
        const invalidId = new ObjectID();

        const response = await app.inject({
          method: 'DELETE',
          url: `/events/${invalidId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'planningReferent', expectedCode: 200 },
        {
          name: 'auxiliary event',
          expectedCode: 200,
          customCredentials: auxiliaries[0].local,
        },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'DELETE',
            url: `/events/${eventsList[2]._id.toHexString()}`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('DELETE /events', () => {
    describe('AdminClient', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('adminClient');
      });

      it('should delete all events from startDate including repetitions', async () => {
        const customer = customerAuxiliary._id;
        const startDate = '2019-10-14';
        const response = await app.inject({
          method: 'DELETE',
          url: `/events?customer=${customer}&startDate=${startDate}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(await Repetition.find({ company: authCompany._id })).toHaveLength(0);
      });


      it('should delete all events from startDate to endDate', async () => {
        const customer = customerAuxiliary._id;
        const startDate = '2019-10-14';
        const endDate = '2019-10-16';

        const response = await app.inject({
          method: 'DELETE',
          url: `/events?customer=${customer}&startDate=${startDate}&endDate=${endDate}`,
          headers: { 'x-access-token': authToken },
        });
        expect(response.statusCode).toBe(200);
      });

      it('should not delete events if one event is billed', async () => {
        const customer = customerAuxiliary._id;
        const startDate = '2019-01-01';
        const endDate = '2019-10-16';

        const response = await app.inject({
          method: 'DELETE',
          url: `/events?customer=${customer}&startDate=${startDate}&endDate=${endDate}`,
          headers: { 'x-access-token': authToken },
        });
        expect(response.statusCode).toBe(409);
      });

      it('should return a 403 if customer is not from the company', async () => {
        const startDate = '2019-01-01';
        const response = await app.inject({
          method: 'DELETE',
          url: `/events?customer=${customerFromOtherCompany._id}&startDate=${startDate}`,
          headers: { 'x-access-token': authToken },
        });
        expect(response.statusCode).toBe(403);
      });
    });

    describe('Other roles', () => {
      beforeEach(populateDB);

      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'planningReferent', expectedCode: 200 },
        { name: 'auxiliaryWithoutCompany', expectedCode: 403 },
        { name: 'coach', expectedCode: 200 },
      ];

      roles.forEach((role) => {
        const customer = customerAuxiliary._id;
        const startDate = '2019-10-14';
        const endDate = '2019-10-16';

        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = role.customCredentials ? await getUserToken(role.customCredentials) : await getToken(role.name);
          const response = await app.inject({
            method: 'DELETE',
            url: `/events?customer=${customer}&startDate=${startDate}&endDate=${endDate}`,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });
});
