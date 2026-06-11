import { AiQuestionIntentRouter } from './ai-question-intent-router.service';

describe('AiQuestionIntentRouter', () => {
  const router = new AiQuestionIntentRouter();

  it('routes ROAS questions to unavailable metrics', () => {
    expect(router.route('Why is ROAS unavailable?')).toBe('UNAVAILABLE_METRICS');
  });

  it('routes facts questions to top facts', () => {
    expect(router.route('What are the main detected facts?')).toBe('TOP_FACTS');
  });

  it('routes media source questions to media source performance', () => {
    expect(router.route('Which media source performed better?')).toBe('MEDIA_SOURCE_PERFORMANCE');
  });
});
