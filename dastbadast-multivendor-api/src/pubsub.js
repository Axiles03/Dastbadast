// dastbadast-multivendor-api/src/pubsub.js
//
// ⚠️ DEPRECATED: re-export из src/pubsub/index.js.
// Существующие импорты `import { pubsub, TOPICS } from "../pubsub.js"`
// продолжают работать. В Шаге 3 переедем на новый путь напрямую.
//
export { pubsub, inMemoryFallback, TOPICS } from "./pubsub/index.js";
