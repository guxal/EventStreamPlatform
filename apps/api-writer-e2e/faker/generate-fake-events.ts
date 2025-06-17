import axios from 'axios';
import { faker } from '@faker-js/faker';

const API_URL = 'http://localhost:3001/api/events';

async function sendFakeEvent() {
  const event = {
    eventType: 'login',
    userId: faker.string.uuid(),
    timestamp: faker.date.recent().toISOString(),
    properties: { level: faker.number.int({ min: 1, max: 50 }) },
    context: { country: faker.location.country(), ip: faker.internet.ip() },
  };
  await axios.post(API_URL, event);
}

async function main() {
  for (let i = 0; i < 5000; i++) {
    await sendFakeEvent();
  }
}

main().catch(console.error);
