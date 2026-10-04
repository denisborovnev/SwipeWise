import { parseExamples, validateCourseName, validateListName, validateWord } from '../validation';

const lists = [{ id: 'L1', name: 'Travel', createdAt: 'x' }];

describe('validateListName', () => {
  it.each([
    ['', 'enter a name'],
    ['   ', 'enter a name'],
    ['_notes', 'start with "_"'],
    ['A/B', 'characters'],
    ['What?', 'characters'],
    ['[x]', 'characters'],
    ['x'.repeat(88), 'at most 87'],
    [' travel ', 'already exists'],
  ])('rejects %j', (name, message) => {
    expect(validateListName(name, lists)).toContain(message);
  });

  it('accepts a valid name', () => {
    expect(validateListName('Kitchen – nouns', lists)).toBeNull();
  });

  it('allows keeping the same name when renaming', () => {
    expect(validateListName('Travel', lists, 'L1')).toBeNull();
  });
});

describe('validateWord', () => {
  it('requires both sides', () => {
    expect(validateWord({ front: 'a', back: ' ' })).not.toBeNull();
    expect(validateWord({ front: '', back: 'b' })).not.toBeNull();
    expect(validateWord({ front: 'a', back: 'b' })).toBeNull();
  });
});

describe('parseExamples', () => {
  it('splits by line and drops empty lines', () => {
    expect(parseExamples(' One. \n\n  Two.\n ')).toEqual(['One.', 'Two.']);
  });
});

describe('validateCourseName', () => {
  const courses = [{ id: 'A', name: 'English', language: 'en-GB', createdAt: 'x' }];

  it('requires a unique name of limited length', () => {
    expect(validateCourseName('  ', courses)).toMatch(/enter a name/);
    expect(validateCourseName('english', courses)).toMatch(/already exists/);
    expect(validateCourseName('English', courses, 'A')).toBeNull();
    expect(validateCourseName('x'.repeat(51), courses)).toMatch(/at most 50/);
    expect(validateCourseName('Spanish', courses)).toBeNull();
  });
});
