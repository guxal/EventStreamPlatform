import axios from 'axios';

describe('API Writer (e2e) — Black-box style', () => {
  // Asegúrate de tener corriendo tu API (ejemplo: nx serve api-writer)

  it('should create an event (POST /api/events)', async () => {
    const eventDto = {
      eventType: 'TestType',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      properties: { score: 100, level: 3 },
    };

    // Cambia el puerto si tu API no corre en 3000
    const response = await axios.post('http://localhost:3000/api/events', eventDto);

    expect(response.status).toBe(201); // O 200, según tu API
    expect(response.data).toHaveProperty('id');
    expect(response.data.eventType).toBe(eventDto.eventType);
    expect(response.data.userId).toBe(eventDto.userId);
    // ...agrega más checks si quieres
  });
});
