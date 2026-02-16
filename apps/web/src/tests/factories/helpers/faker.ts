import { fakerJA } from '@faker-js/faker';
import { seedFaker } from '@test-utils/factory/seededFaker';

export const faker = seedFaker(fakerJA, 123);
