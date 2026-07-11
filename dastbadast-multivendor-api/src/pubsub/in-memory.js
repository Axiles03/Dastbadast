// dastbadast-multivendor-api/src/pubsub/in-memory.js
//
// In-memory PubSub (для dev и single-instance prod).
// Использует EventEmitter из graphql-subscriptions.
// ⚠️ НЕ работает при >1 инстансе API (события из инстанса A не дойдут до клиента на инстансе B).
// В production используйте redis-pubsub.

import { PubSub } from "graphql-subscriptions";

export class InMemoryPubSub {
  constructor() {
    this.pubsub = new PubSub();
  }

  asyncIterator(triggers) {
    const arr = Array.isArray(triggers) ? triggers : [triggers];
    return this.pubsub.asyncIterator(arr);
  }

  async publish(trigger, payload) {
    await this.pubsub.publish(trigger, payload);
  }
}
