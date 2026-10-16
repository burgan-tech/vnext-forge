import { describe, expect, it } from 'vitest';

import { kafkaTopicHint } from './DaprPubSubTaskForm';

describe('kafkaTopicHint', () => {
  it('stays quiet for prefixed topics, empty topics and unknown domains', () => {
    expect(kafkaTopicHint('vnext.core.production.order-created.v1', 'core')).toBeNull();
    expect(kafkaTopicHint('', 'core')).toBeNull();
    expect(kafkaTopicHint('orders', undefined)).toBeNull();
  });

  it('suggests the domain prefix otherwise', () => {
    expect(kafkaTopicHint('orders', 'core')).toContain('vnext.core.{environment}');
    expect(kafkaTopicHint('vnext.other.prod.x', 'core')).toContain('vnext.core.*');
  });
});
