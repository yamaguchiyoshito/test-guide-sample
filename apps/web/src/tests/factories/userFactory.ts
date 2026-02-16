import { faker } from './helpers/faker';

export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: 'user' | 'admin' | 'guest';
}

export const userFactory = {
  build: (overrides: Partial<User> = {}): User => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    age: faker.number.int({ min: 18, max: 80 }),
    role: 'user',
    ...overrides,
  }),

  buildList: (count = 3, overrides: Partial<User> = {}): User[] => {
    return Array.from({ length: count }, () => userFactory.build(overrides));
  },
};
