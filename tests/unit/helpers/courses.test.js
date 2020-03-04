const sinon = require('sinon');
const expect = require('expect');
const Course = require('../../../src/models/Course');
const CourseHelper = require('../../../src/helpers/courses');
require('sinon-mongoose');

describe('createCourse', () => {
  let save;
  beforeEach(() => {
    save = sinon.stub(Course.prototype, 'save').returnsThis();
  });
  afterEach(() => {
    save.restore();
  });

  it('should create a course', async () => {
    const newCourse = { name: 'name' };

    const result = await CourseHelper.createCourse(newCourse);
    expect(result).toMatchObject(newCourse);
  });
});

describe('list', () => {
  let CourseMock;
  beforeEach(() => {
    CourseMock = sinon.mock(Course);
  });
  afterEach(() => {
    CourseMock.restore();
  });

  it('should return courses', async () => {
    const coursesList = [{ name: 'name' }, { name: 'course' }];

    CourseMock.expects('find')
      .withExactArgs({ type: 'toto' })
      .chain('lean')
      .once()
      .returns(coursesList);

    const result = await CourseHelper.list({ type: 'toto' });
    expect(result).toMatchObject(coursesList);
  });
});
