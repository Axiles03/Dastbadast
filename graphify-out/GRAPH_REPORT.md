# Graph Report - /Users/motionup/Desktop/Dastbadast-main  (2026-07-13)

## Corpus Check
- Large corpus: 283 files · ~128,663 words. Graph generation will take longer and produce larger artifacts. Consider running on a subfolder first, or targeting a smaller high-value slice of the repo.

## Summary
- 822 nodes · 1671 edges · 207 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Structure Signals
- Entity graph basis: 652 non-file, non-concept node(s)
- Weakly connected components: 128
- Singleton components: 74
- Isolated nodes: 74
- Largest component: 201 node(s) (31% of the entity graph basis)
- Low-cohesion communities: 1
- Largest low-cohesion community: 27 node(s) (cohesion 0.07)

## Workspace Bridges
1. `debugLog\(\)` - connects `Dastbadast Multivendor API Admin`, `Dastbadast Multivendor API Cache`, `Dastbadast Multivendor API Cache — Auth`, `Dastbadast Multivendor API Delivery Price Service`, `Dastbadast Multivendor API Geoapify — Distance`, `Dastbadast Multivendor API Graceful Shutdown`, `Dastbadast Multivendor API Notifications`, `Dastbadast Multivendor API Notifications — Push`, `Dastbadast Multivendor API Order Search`, `Dastbadast Multivendor API Recommend Indexes`, `Dastbadast Multivendor API Redis`, `Dastbadast Multivendor API Redis Pubsub — Constructor`, `Dastbadast Multivendor API Rider Location Service`; home: `Dastbadast Multivendor API Cleanup Cron`; degree 25; score 8258.67
  source files: `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/scripts/recommend-indexes.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/cleanup-cron.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/debug-log.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/index.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/jobs/rider-location-flush.job.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/middleware/cache.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/middleware/graceful-shutdown.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/pubsub/index.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/pubsub/redis-pubsub.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/resolvers/notifications.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/resolvers/order-search.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/services/delivery-price.service.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/utils/geoapify.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/utils/redis.js`
2. `debugWarn\(\)` - connects `Dastbadast Multivendor API Cache`, `Dastbadast Multivendor API Cleanup Cron`, `Dastbadast Multivendor API Delivery Price Service`, `Dastbadast Multivendor API Geoapify`, `Dastbadast Multivendor API Geoapify — Distance`, `Dastbadast Multivendor API Graceful Shutdown`, `Dastbadast Multivendor API Notifications`, `Dastbadast Multivendor API Order Search`, `Dastbadast Multivendor API Order Search — Exclude`; home: `Dastbadast Multivendor API Redis`; degree 14; score 2698.82
  source files: `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/cleanup-cron.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/debug-log.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/jobs/rider-location-flush.job.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/middleware/graceful-shutdown.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/pubsub/redis-pubsub.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/resolvers/notifications.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/resolvers/order-search.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/services/delivery-price.service.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/utils/geoapify.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/utils/redis.js`
3. `EmptyState\(\)` - connects `Dastbadast Multivendor Admin Page — Format`, `Dastbadast Multivendor Client Address`, `Dastbadast Multivendor Client Cart — Bar`, `Dastbadast Multivendor Client Home`, `Dastbadast Multivendor Client ID — Chip`, `Dastbadast Multivendor Store Menu`, `Dastbadast Multivendor Store New`, `Dastbadast Multivendor Store Processing`; home: `Dastbadast Multivendor Admin Orders`; degree 9; score 20996.4
  source files: `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-admin/app/accounting/page.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/app/\(app\)/address.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/app/\(app\)/cart.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/app/\(app\)/home.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/app/\(app\)/orders.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/app/\(app\)/restaurant/\[id\].tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-store/app/\(tabs\)/menu.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-store/app/\(tabs\)/new.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-store/app/\(tabs\)/processing.tsx`
4. `debugError\(\)` - connects `Dastbadast Multivendor API Cache`, `Dastbadast Multivendor API In Memory — Js`, `Dastbadast Multivendor API Order Actions`, `Dastbadast Multivendor API Redis Pubsub`, `Dastbadast Multivendor API Redis Pubsub — Constructor`, `Dastbadast Multivendor API Rider Location Service`; home: `Dastbadast Multivendor API Order Search`; degree 8; score 2438.02
  source files: `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/debug-log.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/jobs/rider-location-flush.job.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/pubsub/redis-pubsub.js`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/resolvers/order-search.js`
5. `ProfileInner\(\)` - connects `Dastbadast Multivendor Admin Page — Login`, `Dastbadast Multivendor Web Page — Avatar \(3\)`, `Dastbadast Multivendor Web Page — Edit`, `Dastbadast Multivendor Web Page — Phone`, `Dastbadast Multivendor Web Page — Profile`; home: `Dastbadast Multivendor Web Page — Avatar`; degree 9; score 2441.82
  source files: `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-web/app/\(main\)/profile/page.tsx`
6. `RestaurantPage\(\)` - connects `Dastbadast Multivendor Admin Orders`, `Dastbadast Multivendor Client Home`, `Dastbadast Multivendor Web Food Card`, `Dastbadast Multivendor Web Modifier Group`, `Dastbadast Multivendor Web Use Food Modifiers`; home: `Dastbadast Multivendor Client ID — Chip`; degree 7; score 2160.44
  source files: `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-admin/app/accounting/page.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/app/\(app\)/restaurant/\[id\].tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/components/CartBar.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-web/components/FoodCard.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-web/components/modifiers/ModifierGroup.tsx`, `/Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-web/hooks/useFoodModifiers.ts`

## God Nodes
1. `debugLog\(\)` - 39 edges
2. `requireRole\(\)` - 36 edges
3. `debugWarn\(\)` - 25 edges
4. `layout /` - 16 edges
5. `app` - 15 edges
6. `order\(\)` - 15 edges
7. `calculateServerDeliveryPrice\(\)` - 14 edges
8. `rider\(\)` - 14 edges
9. `tryRedis\(\)` - 14 edges
10. `AdminsInner\(\)` - 13 edges

## Surprising Connections
- `handleAdd\(\)` --calls--> `coverFor\(\)`  [EXTRACTED]
  /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/components/FoodCard.tsx → /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-web/components/FoodCard.tsx  _bridges separate communities; peripheral node \`handleAdd\(\)\` unexpectedly reaches hub \`coverFor\(\)\`_
- `run\(\)` --calls--> `debugLog\(\)`  [EXTRACTED]
  /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/scripts/recommend-indexes.js → /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-api/src/debug-log.js  _bridges separate communities; peripheral node \`run\(\)\` unexpectedly reaches hub \`debugLog\(\)\`_
- `openFood\(\)` --calls--> `coverFor\(\)`  [EXTRACTED]
  /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-client/app/\(app\)/restaurant/\[id\].tsx → /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-web/components/FoodCard.tsx  _bridges separate communities; peripheral node \`openFood\(\)\` unexpectedly reaches hub \`coverFor\(\)\`_
- `AdminsInner\(\)` --renders--> `MetricChip\(\)`  [EXTRACTED]
  /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-admin/app/admins/page.tsx → /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-admin/app/users/page.tsx  _bridges separate communities_
- `AdminsInner\(\)` --renders--> `Field\(\)`  [EXTRACTED]
  /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-admin/app/admins/page.tsx → /Users/motionup/Desktop/Dastbadast-main/dastbadast-multivendor-web/app/\(main\)/profile/page.tsx  _bridges separate communities_

## Semantic Anomalies
- **[HIGH] Bridge node** - EmptyState\(\) bridges Dastbadast Multivendor Admin Orders and Dastbadast Multivendor Admin Page — Format, Dastbadast Multivendor Web Page, Dastbadast Multivendor Client Address, Dastbadast Multivendor Client Cart — Bar, Dastbadast Multivendor Client Home, Dastbadast Multivendor Client ID — Chip, Dastbadast Multivendor Store Menu, Dastbadast Multivendor Store New, Dastbadast Multivendor Store Processing.
  _High betweenness centrality \(20907.399\) across 10 communities makes this node a likely dependency chokepoint._
- **[HIGH] Bridge node** - Row\(\) bridges Dastbadast Multivendor Admin Page — Card and Dastbadast Multivendor Web Page, Dastbadast Multivendor Client Cart — Bar, Dastbadast Multivendor Client ID — Countdown, Dastbadast Multivendor Web Page — Countdown, Dastbadast Multivendor Web Cart Drawer.
  _High betweenness centrality \(21740.468\) across 6 communities makes this node a likely dependency chokepoint._
- **[HIGH] Bridge node** - debugLog\(\) bridges Dastbadast Multivendor API Cleanup Cron and Dastbadast Multivendor API Redis, Dastbadast Multivendor API Recommend Indexes, Dastbadast Multivendor API Graceful Shutdown, Dastbadast Multivendor API Admin, Dastbadast Multivendor API Cache, Dastbadast Multivendor API Rider Location Service, Dastbadast Multivendor API Cache — Cache, Dastbadast Multivendor API Cache — Auth, Dastbadast Multivendor API Redis Pubsub — Constructor, Dastbadast Multivendor API Notifications, Dastbadast Multivendor API Notifications — Push, Dastbadast Multivendor API Order Search, Dastbadast Multivendor API Delivery Price Service, Dastbadast Multivendor API Geoapify, Dastbadast Multivendor API Geoapify — Distance.
  _High betweenness centrality \(8103.674\) across 16 communities makes this node a likely dependency chokepoint._
- **[HIGH] Low-cohesion community** - Dastbadast Multivendor API Admin is weakly connected for its size.
  _Cohesion score 0.07 across 27 nodes suggests this community may mix unrelated responsibilities._
- **[HIGH] Cross-boundary edge** - AdminsInner\(\) → Field\(\) crosses graph boundaries in an unexpected way.
  _bridges separate communities_

## Communities

### Community 0 - "Dastbadast Multivendor API Admin"
Cohesion (entity basis within full-graph community): 0.03
Nodes (62): adminAccounting\(\), adminDashboardMetrics\(\), allOrders\(\), allRidersWithLocation\(\), assignRider\(\), buildPermissionsForRole\(\), createOwner\(\), createRestaurant\(\) (+54 more)

### Community 1 - "Dastbadast Multivendor API Server"
Cohesion (entity basis within full-graph community): 0.1
Nodes (21): healthLiveHandler\(\), app, GET /health, GET /health/live, GET /health/metrics, GET /health/ready, GET /info, GET /payments/mock-redirect (+13 more)

### Community 2 - "Dastbadast Multivendor API Notifications"
Cohesion (entity basis within full-graph community): 0.1
Nodes (15): getExpo\(\), haversineKmLegacy\(\), localize\(\), notify\(\), notifyClientOrderAssigned\(\), notifyClientOrderDelivered\(\), notifyClientOrderPendingToPreparing\(\), notifyClientOrderPicked\(\) (+7 more)

### Community 3 - "Dastbadast Multivendor API Delivery"
Cohesion (entity basis within full-graph community): 0.25
Nodes (11): acceptDelivery\(\), arriveAtDropOff\(\), assertCanTransition\(\), markDelivered\(\), markOrderPreparing\(\), markOrderReady\(\), pickupDelivery\(\), requireRestaurant\(\) (+3 more)

### Community 4 - "Dastbadast Multivendor API Restaurant Menu"
Cohesion (entity basis within full-graph community): 0.29
Nodes (10): assertCategoryOwned\(\), assertFoodOwned\(\), createCategory\(\), createFood\(\), deleteCategory\(\), deleteFood\(\), requireRestaurant\(\), updateCategory\(\) (+2 more)

### Community 5 - "Dastbadast Multivendor API Rider"
Cohesion (entity basis within full-graph community): 0.2
Nodes (10): availableOrdersForRiders\(\), changeRiderPassword\(\), claimOrder\(\), meRider\(\), requireRider\(\), riderOrders\(\), stopRiderLocationStream\(\), toggleRider\(\) (+2 more)

### Community 6 - "Dastbadast Multivendor API Food Review"
Cohesion (entity basis within full-graph community): 0.1
Nodes (5): addFoodReview\(\), foodRatingStats\(\), foodReviews\(\), requireUser\(\), run\(\)

### Community 7 - "Dastbadast Multivendor Admin Page"
Cohesion (entity basis within full-graph community): 0.33
Nodes (10): AdminsInner\(\), handleDeactivate\(\), handleReactivate\(\), handleResetPassword\(\), resetForm\(\), showToast\(\), startCreate\(\), startEdit\(\) (+2 more)

### Community 8 - "Dastbadast Multivendor API Order Search"
Cohesion (entity basis within full-graph community): 0.29
Nodes (8): debugError\(\), dispatchCourierSearch\(\), findCandidatesGeoNear\(\), findCandidatesInMemory\(\), getCurrentWaveCount\(\), getOverworkedRiders\(\), isRestaurantHot\(\), startCourierSearchEscalation1\(\)

### Community 9 - "Dastbadast Multivendor Store Menu"
Cohesion (entity basis within full-graph community): 0.22
Nodes (9): MenuScreen\(\), openAddCategory\(\), openAddFood\(\), openEditCategory\(\), openEditFood\(\), removeCategory\(\), removeFood\(\), saveCategory\(\) (+1 more)

### Community 10 - "Dastbadast Multivendor API Rider Location Service"
Cohesion (entity basis within full-graph community): 0.19
Nodes (7): runFlush\(\), getAllRiderIdsInRedis\(\), getRiderLocationFromRedis\(\), locKey\(\), removeRiderFromRedis\(\), publicRiderProfile\(\), rider\(\)

### Community 11 - "Dastbadast Multivendor Web Food Detail Modal"
Cohesion (entity basis within full-graph community): 0.2
Nodes (5): AddToCartButton\(\), FoodDetailModal\(\), submitReview\(\), useAuth\(\), RestaurantMenu\(\)

### Community 12 - "Dastbadast Multivendor Client Home"
Cohesion (entity basis within full-graph community): 0.27
Nodes (6): CartBar\(\), FeaturedImage\(\), FiltersModal\(\), Home\(\), isFoodMatch\(\), ProfileSheet\(\)

### Community 13 - "Dastbadast Multivendor API Delivery Price"
Cohesion (entity basis within full-graph community): 0.29
Nodes (7): calculateDeliveryPrice\(\), calculateDeliveryPriceBreakdown\(\), distanceKm\(\), distanceKmSync\(\), isValidCoord\(\), routeDistanceKm\(\), routeDistanceKmAsync\(\)

### Community 14 - "Dastbadast Multivendor Rider Nativewind Env D"
Cohesion (entity basis within full-graph community): 0
Nodes (7): ImageProps, PressableProps, ScrollViewProps, TextInputProps, TextProps, TouchableOpacityProps, ViewProps

### Community 15 - "Dastbadast Multivendor Web Page"
Cohesion (entity basis within full-graph community): 0
Nodes (7): formatNumber\(\), getRemainingCooldownMs\(\), haversineKm\(\), isInZone\(\), MapSkeleton\(\), RiderSubscriptions\(\), StatusBadge\(\)

### Community 16 - "Dastbadast Multivendor Admin Page — Edit"
Cohesion (entity basis within full-graph community): 0.43
Nodes (8): RestaurantsInner\(\), handleGetCurrentLocation\(\), saveEdit\(\), showErr\(\), showOk\(\), startEdit\(\), submit\(\), toggleAvailable\(\)

### Community 17 - "Dastbadast Multivendor Admin Page — Show"
Cohesion (entity basis within full-graph community): 0.43
Nodes (8): RiderDetailInner\(\), handleToggleActive\(\), onPhotoFile\(\), save\(\), showErr\(\), showOk\(\), startEdit\(\), StatBlock\(\)

### Community 18 - "Dastbadast Multivendor Admin Page — Edit \(2\)"
Cohesion (entity basis within full-graph community): 0.46
Nodes (8): RidersInner\(\), onPhotoFile\(\), quickToggleActive\(\), saveEdit\(\), showErr\(\), showOk\(\), startEdit\(\), submit\(\)

### Community 19 - "Dastbadast Multivendor Admin Page — Edit \(3\)"
Cohesion (entity basis within full-graph community): 0.39
Nodes (8): ZonesInner\(\), cancelEdit\(\), handleDelete\(\), handleToggle\(\), save\(\), showToast\(\), startCreate\(\), startEdit\(\)

### Community 20 - "Dastbadast Multivendor API Cleanup Cron"
Cohesion (entity basis within full-graph community): 0.33
Nodes (6): cleanupRegistry\(\), registerRegistry\(\), startMemoryCleanupJob\(\), debugLog\(\), getInstance\(\), startNotificationTriggers\(\)

### Community 21 - "Dastbadast Multivendor API Restaurant"
Cohesion (entity basis within full-graph community): 0.17
Nodes (4): isObjectId\(\), isRestaurantOpenNow\(\), restaurant\(\), restaurants\(\)

### Community 22 - "Dastbadast Multivendor API Redis"
Cohesion (entity basis within full-graph community): 0.83
Nodes (4): debugWarn\(\), getRedis\(\), initRedis\(\), getSubscriberClient\(\)

### Community 23 - "Dastbadast Multivendor Rider Order Bottom Sheet"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): MapTabContent\(\), ActionButton\(\), OrderBottomSheet\(\), getUrgency\(\)

### Community 24 - "Dastbadast Multivendor Rider Profile"
Cohesion (entity basis within full-graph community): 0.33
Nodes (6): computeStats\(\), NavRow\(\), ProfileScreen\(\), save\(\), startOfToday\(\), StatRow\(\)

### Community 25 - "Dastbadast Multivendor API Health"
Cohesion (entity basis within full-graph community): 0.5
Nodes (5): getCacheStats\(\), getMongoStatus\(\), getRedisStatus\(\), healthMetricsHandler\(\), healthReadyHandler\(\)

### Community 26 - "Dastbadast Multivendor API Delivery Price Service"
Cohesion (entity basis within full-graph community): 0.4
Nodes (5): assertPointInActiveZone\(\), calculateServerDeliveryPrice\(\), getPricingConfig\(\), validateCoordinates\(\), validateDeliveryAvailability\(\)

### Community 27 - "Dastbadast Multivendor Web Filters Drawer"
Cohesion (entity basis within full-graph community): 0.4
Nodes (5): FiltersDrawer\(\), apply\(\), reset\(\), Group\(\), Option\(\)

### Community 28 - "Dastbadast Multivendor Web Layout"
Cohesion (entity basis within full-graph community): 0.2
Nodes (5): AuthLayout\(\), MainLayout\(\), RootLayout\(\), TabsLayout\(\), layout /

### Community 29 - "Dastbadast Multivendor Rider Login"
Cohesion (entity basis within full-graph community): 0.33
Nodes (6): Login\(\), handleResetUrl\(\), handleSaveUrl\(\), handleTest\(\), openUrlModal\(\), submit\(\)

### Community 30 - "Dastbadast Multivendor Rider Map Config"
Cohesion (entity basis within full-graph community): 0.2
Nodes (5): formatDistance\(\), getLatLng\(\), getLngLat\(\), haversineKm\(\), isValidCoord\(\)

### Community 31 - "Dastbadast Multivendor API Order Search — Exclude"
Cohesion (entity basis within full-graph community): 0.6
Nodes (6): addToExcludeList\(\), clearCourierExcludeList\(\), getExcludeList\(\), checkRateLimit\(\), isRedisReady\(\), tryRedis\(\)

### Community 32 - "Dastbadast Multivendor Admin Page — Edit \(4\)"
Cohesion (entity basis within full-graph community): 0.47
Nodes (6): FieldEdit\(\), RestaurantDetailInner\(\), save\(\), showErr\(\), showOk\(\), startEdit\(\)

### Community 33 - "Dastbadast Multivendor API Alif"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): AlifProvider, .createPayment\(\), .handleWebhook\(\), .verifySignature\(\)

### Community 34 - "Dastbadast Multivendor API Chat"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): canAccessOrder\(\), chatMessages\(\), sendChatMessage\(\)

### Community 35 - "Dastbadast Multivendor API Graceful Shutdown"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): stopMemoryCleanupJob\(\), setupGracefulShutdown\(\), onSignal\(\), stopRiderLocationFlushJob\(\)

### Community 36 - "Dastbadast Multivendor API Cod"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): CodProvider, .createPayment\(\), .handleWebhook\(\), .verifySignature\(\)

### Community 37 - "Dastbadast Multivendor API Dc"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): DcProvider, .createPayment\(\), .handleWebhook\(\), .verifySignature\(\)

### Community 38 - "Dastbadast Multivendor Rider Edit Profile"
Cohesion (entity basis within full-graph community): 0.4
Nodes (5): EditProfileScreen\(\), handleChangePassword\(\), handleForgotPassword\(\), handleSaveProfile\(\), pickPhoto\(\)

### Community 39 - "Dastbadast Multivendor API Geo"
Cohesion (entity basis within full-graph community): 0.17
Nodes (4): etaSeconds\(\), haversineKm\(\), pointInCircle\(\), sortByDistance\(\)

### Community 40 - "Dastbadast Multivendor API Geoapify"
Cohesion (entity basis within full-graph community): 0
Nodes (4): clearRouteCache\(\), fetchRouteGeometry\(\), getCacheStats\(\), setCached\(\)

### Community 41 - "Dastbadast Multivendor API Geoapify — Distance"
Cohesion (entity basis within full-graph community): 0.6
Nodes (5): fetchRouteDistance\(\), getCached\(\), getDistanceMeters\(\), makeKey\(\), round\(\)

### Community 42 - "Dastbadast Multivendor API Order Actions"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): acceptOrder\(\), cancelOrder\(\), requireRestaurant\(\), scheduleJustInTimeDispatch\(\)

### Community 43 - "Dastbadast Multivendor Rider Order Card"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): AddressBlock\(\), OrderCard\(\), pluralize\(\), StatusBadge\(\)

### Community 44 - "Dastbadast Multivendor Rider Orders"
Cohesion (entity basis within full-graph community): 0.33
Nodes (3): OrdersScreen\(\), showToast\(\), RiderTopBar\(\)

### Community 45 - "Dastbadast Multivendor Admin Page — Format"
Cohesion (entity basis within full-graph community): 0.4
Nodes (5): AccountingInner\(\), formatCurrency\(\), formatDateForInput\(\), KpiCard\(\), SecondaryMetric\(\)

### Community 46 - "Dastbadast Multivendor Admin Page — Login"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): Field\(\), LoginPage\(\), submit\(\), page /login

### Community 47 - "Dastbadast Multivendor Admin Page — Details"
Cohesion (entity basis within full-graph community): 0.4
Nodes (5): MapPageUI\(\), OrderDetails\(\), RiderDetails\(\), StatCard\(\), ToggleRow\(\)

### Community 48 - "Dastbadast Multivendor Store Processing"
Cohesion (entity basis within full-graph community): 0.4
Nodes (5): Processing\(\), handleMarkReady\(\), PrepCountdown\(\), renderCookingItem\(\), renderHistoryItem\(\)

### Community 49 - "Dastbadast Multivendor Store Empty State"
Cohesion (entity basis within full-graph community): 1
Nodes (1): EmptyState\(\)

### Community 50 - "Dastbadast Multivendor Web Food Card"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): handleAdd\(\), coverFor\(\), hash\(\)

### Community 51 - "Dastbadast Multivendor Web Auth Modal"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): AuthModal\(\), Inner\(\), submit\(\)

### Community 52 - "Dastbadast Multivendor API Cache"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): startCacheInvalidationSubscriber\(\), bootstrap\(\), csvEscape\(\), startRiderLocationFlushJob\(\)

### Community 53 - "Dastbadast Multivendor Web Category Chips"
Cohesion (entity basis within full-graph community): 0
Nodes (2): CategoryChips\(\), hash\(\)

### Community 54 - "Dastbadast Multivendor Web Food Card — Add"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): FoodCard\(\), handleAdd\(\), setFlash\(\), HomeClient\(\)

### Community 55 - "Dastbadast Multivendor Rider History"
Cohesion (entity basis within full-graph community): 0.33
Nodes (3): HistoryScreen\(\), PeriodTab\(\), startOfToday\(\)

### Community 56 - "Dastbadast Multivendor Client ID"
Cohesion (entity basis within full-graph community): 0
Nodes (3): categoryEmoji\(\), haversineKm\(\), Row\(\)

### Community 57 - "Dastbadast Multivendor Client ID — Countdown"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): formatCountdown\(\), minutesWord\(\), TrackingPage\(\), tick\(\)

### Community 58 - "Dastbadast Multivendor API In Memory"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): InMemoryPubSub, .asyncIterator\(\), .constructor\(\), .publish\(\)

### Community 59 - "Dastbadast Multivendor API Payments"
Cohesion (entity basis within full-graph community): 0.33
Nodes (3): getProvider\(\), handlePaymentWebhook\(\), paymentMethods\(\)

### Community 60 - "Dastbadast Multivendor Web Left Sidebar"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): LeftSidebar\(\), isActive\(\), onKey\(\), ProfileAvatar\(\)

### Community 61 - "Dastbadast Multivendor Client Login"
Cohesion (entity basis within full-graph community): 0
Nodes (3): isValidEmail\(\), isValidPassword\(\), isValidPhone\(\)

### Community 62 - "Dastbadast Multivendor Store New"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): NewOrders\(\), confirmAccept\(\), PrepTimeModal\(\)

### Community 63 - "Dastbadast Multivendor API Notifications — Push"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): myPushTokens\(\), registerPushToken\(\), requireAuth\(\), unregisterPushToken\(\)

### Community 64 - "Dastbadast Multivendor API Order"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): meRestaurant\(\), requireRestaurant\(\), restaurantOrders\(\)

### Community 65 - "Dastbadast Multivendor Admin Page — Cancel"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): CancelledOrderCard\(\), cancelReasonLabel\(\), getCancelIcon\(\), timeAgo\(\)

### Community 66 - "Dastbadast Multivendor Web Page — Bar"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): Centered\(\), ProgressBar\(\), useNow\(\), WaitingInner\(\)

### Community 67 - "Dastbadast Multivendor Admin Page — Configuration"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): ConfigurationInner\(\), submit\(\), FormField\(\), SectionGroup\(\)

### Community 68 - "Dastbadast Multivendor Admin Page — Dashboard"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): DashboardInner\(\), DrillableSection\(\), getFirstName\(\), QuickLink\(\)

### Community 69 - "Dastbadast Multivendor Admin Page — Assign"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): DispatchInner\(\), doAssign\(\), MetricPill\(\), RiderPickerModal\(\)

### Community 70 - "Dastbadast Multivendor Web Page — Avatar"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): LinkItem\(\), ProfileInner\(\), onAvatarFile\(\), triggerAvatarPicker\(\)

### Community 71 - "Dastbadast Multivendor Admin Page — Page"
Cohesion (entity basis within full-graph community): 0.33
Nodes (3): RootPage\(\), layout /, page /

### Community 72 - "Dastbadast Multivendor Admin Page — Handle"
Cohesion (entity basis within full-graph community): 0.67
Nodes (4): UserListItem\(\), UsersInner\(\), handleToggle\(\), showToast\(\)

### Community 73 - "Dastbadast Multivendor Web Restaurant Card"
Cohesion (entity basis within full-graph community): 1
Nodes (2): hash\(\), RestaurantCard\(\)

### Community 74 - "Dastbadast Multivendor API Redis Pubsub"
Cohesion (entity basis within full-graph community): 0.5
Nodes (4): localListenersKey\(\), .asyncIterator\(\), resolver\(\), tryNext\(\)

### Community 75 - "Dastbadast Multivendor Rider Screen Header"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): ListMapToggle\(\), ScreenHeader\(\), handleBack\(\)

### Community 76 - "Dastbadast Multivendor Client Address"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): AddressPage\(\), addCurrentLocation\(\), addManual\(\)

### Community 77 - "Dastbadast Multivendor Web Address Picker"
Cohesion (entity basis within full-graph community): 0
Nodes (2): markerEl\(\), zoneFeature\(\)

### Community 78 - "Dastbadast Multivendor Store Apollo D"
Cohesion (entity basis within full-graph community): 0
Nodes (2): Data, Variables

### Community 79 - "Dastbadast Multivendor Web Auth Buttons"
Cohesion (entity basis within full-graph community): 1
Nodes (1): AuthButtons\(\)

### Community 80 - "Dastbadast Multivendor API Cache — Cache"
Cohesion (entity basis within full-graph community): 0
Nodes (2): clearCache\(\), extractOperationName\(\)

### Community 81 - "Dastbadast Multivendor API Cache — Auth"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): cacheMiddleware\(\), resolveContextFromAuthHeader\(\), createServer\(\)

### Community 82 - "Dastbadast Multivendor Client Cart"
Cohesion (entity basis within full-graph community): 0
Nodes (2): estimateDelivery\(\), Row\(\)

### Community 83 - "Dastbadast Multivendor Client Cart — Bar"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): CartPage\(\), onPlaceOrder\(\), HeaderBar\(\)

### Community 84 - "Dastbadast Multivendor API Cart"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): clearCart\(\), getCart\(\), requireUser\(\)

### Community 85 - "Dastbadast Multivendor Web Cart Drawer"
Cohesion (entity basis within full-graph community): 0
Nodes (2): CartDrawer\(\), Row\(\)

### Community 86 - "Dastbadast Multivendor API Subscriptions"
Cohesion (entity basis within full-graph community): 1
Nodes (2): trackSubscription\(\), wrapSubscribe\(\)

### Community 87 - "Dastbadast Multivendor Web Horizontal Carousel"
Cohesion (entity basis within full-graph community): 1
Nodes (2): HorizontalCarousel\(\), scroll\(\)

### Community 88 - "Dastbadast Multivendor Client ID — Chip"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): DeliveryFromChip\(\), RestaurantPage\(\), openFood\(\)

### Community 89 - "Dastbadast Multivendor API IDs"
Cohesion (entity basis within full-graph community): 1
Nodes (2): shortOrderId\(\), placeOrder\(\)

### Community 90 - "Dastbadast Multivendor Rider Log Bridge"
Cohesion (entity basis within full-graph community): 1
Nodes (2): AppLayout\(\), LogBridge\(\)

### Community 91 - "Dastbadast Multivendor Rider List Map Switcher"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ListMapSwitcher\(\), Segment\(\)

### Community 92 - "Dastbadast Multivendor Admin Map View"
Cohesion (entity basis within full-graph community): 0
Nodes (2): makeRestaurantEl\(\), makeRiderEl\(\)

### Community 93 - "Dastbadast Multivendor API Migrate Order Status"
Cohesion (entity basis within full-graph community): 0
Nodes (2): run\(\), order\(\)

### Community 94 - "Dastbadast Multivendor Web Modifier Group"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ModifierGroup\(\), handleSelect\(\)

### Community 95 - "Dastbadast Multivendor API Order — Point"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): assertAddressInZone\(\), findZoneForPoint\(\), pointInPolygon\(\)

### Community 96 - "Dastbadast Multivendor API Order — Confirm"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): confirmOrderReceived\(\), orders\(\), requireUser\(\)

### Community 97 - "Dastbadast Multivendor Web Order Status Stage"
Cohesion (entity basis within full-graph community): 1
Nodes (2): minutesWord\(\), OrderStatusStage\(\)

### Community 98 - "Dastbadast Multivendor Web Order Tracking Map"
Cohesion (entity basis within full-graph community): 0
Nodes (2): OrderTrackingMap\(\), riderEl\(\)

### Community 99 - "Dastbadast Multivendor Web Order Tracking Map — El"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): syncMap\(\), run\(\), pinEl\(\)

### Community 100 - "Dastbadast Multivendor Admin Page — Accounting"
Cohesion (entity basis within full-graph community): 1
Nodes (2): AccountingPage\(\), page /accounting

### Community 101 - "Dastbadast Multivendor Web Page — Address"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): AddressInner\(\), submit\(\), useMyLocation\(\)

### Community 102 - "Dastbadast Multivendor Web Page — Address \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): AddressPage\(\), page /address

### Community 103 - "Dastbadast Multivendor Admin Page — Admins"
Cohesion (entity basis within full-graph community): 1
Nodes (2): AdminsPage\(\), page /admins

### Community 104 - "Dastbadast Multivendor Admin Page — Cohorts"
Cohesion (entity basis within full-graph community): 1
Nodes (2): CohortsPage\(\), page /users/cohorts

### Community 105 - "Dastbadast Multivendor Admin Page — Configuration \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ConfigurationPage\(\), page /configuration

### Community 106 - "Dastbadast Multivendor Admin Page — Dashboard \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): DashboardPage\(\), page /dashboard

### Community 107 - "Dastbadast Multivendor Admin Page — Dispatch"
Cohesion (entity basis within full-graph community): 1
Nodes (2): DispatchPage\(\), page /dispatch

### Community 108 - "Dastbadast Multivendor Web Page — Countdown"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): formatCountdown\(\), TrackingInner\(\), tick\(\)

### Community 109 - "Dastbadast Multivendor Web Page — Edit"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): formatRemaining\(\), markEditTimestamp\(\), save\(\)

### Community 110 - "Dastbadast Multivendor Web Page — Avatar \(2\)"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): getAvatar\(\), getAvatarKey\(\), saveAvatar\(\)

### Community 111 - "Dastbadast Multivendor Web Page — Cat"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): Home\(\), findCat\(\), mapFoods\(\)

### Community 112 - "Dastbadast Multivendor Admin Page — Map"
Cohesion (entity basis within full-graph community): 1
Nodes (2): MapPage\(\), page /map

### Community 113 - "Dastbadast Multivendor Web Page — Inner"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): OrdersInner\(\), repeatOrder\(\), StatusPills\(\)

### Community 114 - "Dastbadast Multivendor Web Page — Orders"
Cohesion (entity basis within full-graph community): 1
Nodes (2): OrdersPage\(\), page /orders

### Community 115 - "Dastbadast Multivendor Web Page — Privacy"
Cohesion (entity basis within full-graph community): 1
Nodes (2): PrivacyPage\(\), page /privacy

### Community 116 - "Dastbadast Multivendor Web Page — Profile"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ProfilePage\(\), page /profile

### Community 117 - "Dastbadast Multivendor Admin Page — ID"
Cohesion (entity basis within full-graph community): 1
Nodes (2): RestaurantDetailPage\(\), page /restaurants/\[id\]

### Community 118 - "Dastbadast Multivendor Web Page — Restaurant"
Cohesion (entity basis within full-graph community): 1
Nodes (2): RestaurantPage\(\), page /restaurant/\[id\]

### Community 119 - "Dastbadast Multivendor Admin Page — Restaurants"
Cohesion (entity basis within full-graph community): 1
Nodes (2): RestaurantsPage\(\), page /restaurants

### Community 120 - "Dastbadast Multivendor Admin Page — ID \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): RiderDetailPage\(\), page /riders/\[id\]

### Community 121 - "Dastbadast Multivendor Admin Page — Riders"
Cohesion (entity basis within full-graph community): 1
Nodes (2): RidersPage\(\), page /riders

### Community 122 - "Dastbadast Multivendor Web Page — Tracking"
Cohesion (entity basis within full-graph community): 1
Nodes (2): TrackingPage\(\), page /order/\[id\]/tracking

### Community 123 - "Dastbadast Multivendor Admin Page — Users"
Cohesion (entity basis within full-graph community): 1
Nodes (2): UsersPage\(\), page /users

### Community 124 - "Dastbadast Multivendor Web Page — Waiting"
Cohesion (entity basis within full-graph community): 1
Nodes (2): WaitingPage\(\), page /orders/\[id\]/waiting

### Community 125 - "Dastbadast Multivendor Admin Page — Zones"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ZonesPage\(\), page /zones

### Community 126 - "Dastbadast Multivendor Store Segmented Tabs"
Cohesion (entity basis within full-graph community): 1
Nodes (1): SegmentedTabs\(\)

### Community 127 - "Dastbadast Multivendor API Redis Pubsub — Constructor"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): RedisPubSub, .constructor\(\), .init\(\)

### Community 128 - "Dastbadast Multivendor Web Require Auth"
Cohesion (entity basis within full-graph community): 1
Nodes (2): GuestGate\(\), RequireAuth\(\)

### Community 129 - "Dastbadast Multivendor API Rider — Location"
Cohesion (entity basis within full-graph community): 0.67
Nodes (3): haversineKm\(\), setRiderLocationInRedis\(\), updateRiderLocation\(\)

### Community 130 - "Dastbadast Multivendor Web Top Header"
Cohesion (entity basis within full-graph community): 1
Nodes (1): TopHeader\(\)

### Community 131 - "Dastbadast Multivendor Admin Top Bar"
Cohesion (entity basis within full-graph community): 1
Nodes (3): TopBar\(\), isActive\(\), linkClass\(\)

### Community 132 - "Dastbadast Multivendor API Zone Public"
Cohesion (entity basis within full-graph community): 1
Nodes (1): deliveryZone\(\)

### Community 133 - "Dastbadast Multivendor Web Address Picker — Address"
Cohesion (entity basis within full-graph community): 1
Nodes (2): AddressPicker\(\), applyPick\(\)

### Community 134 - "Dastbadast Multivendor API Auth"
Cohesion (entity basis within full-graph community): 1
Nodes (2): signRestaurantToken\(\), restaurantLogin\(\)

### Community 135 - "Dastbadast Multivendor API Auth — Rider"
Cohesion (entity basis within full-graph community): 1
Nodes (2): signRiderToken\(\), riderLogin\(\)

### Community 136 - "Dastbadast Multivendor Web Auth Required"
Cohesion (entity basis within full-graph community): 1
Nodes (1): AuthRequired\(\)

### Community 137 - "Dastbadast Multivendor API Cache — Build"
Cohesion (entity basis within full-graph community): 1
Nodes (2): buildCacheKey\(\), hashQuery\(\)

### Community 138 - "Dastbadast Multivendor API Cart — Cart"
Cohesion (entity basis within full-graph community): 1
Nodes (2): cartItemKey\(\), mergeCartItems\(\)

### Community 139 - "Dastbadast Multivendor API Cart — Cart \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): saveCart\(\), validateAndPriceItems\(\)

### Community 140 - "Dastbadast Multivendor Web Cart Debug Panel"
Cohesion (entity basis within full-graph community): 1
Nodes (1): CartDebugPanel\(\)

### Community 141 - "Dastbadast Multivendor API Cleanup Empty Users"
Cohesion (entity basis within full-graph community): 1
Nodes (1): run\(\)

### Community 142 - "Dastbadast Multivendor API Delivery Subscriptions"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 143 - "Dastbadast Multivendor Rider Edit Profile — Edit"
Cohesion (entity basis within full-graph community): 1
Nodes (1): Field\(\)

### Community 144 - "Dastbadast Multivendor API Geo — Bearing"
Cohesion (entity basis within full-graph community): 1
Nodes (2): bearingDeg\(\), toRad\(\)

### Community 145 - "Dastbadast Multivendor API In Memory — Js"
Cohesion (entity basis within full-graph community): 1
Nodes (1): .publish\(\)

### Community 146 - "Dastbadast Multivendor Admin Map View — Route"
Cohesion (entity basis within full-graph community): 1
Nodes (2): fetchOSRMRoute\(\), getRoute\(\)

### Community 147 - "Dastbadast Multivendor Admin Map View — Color"
Cohesion (entity basis within full-graph community): 1
Nodes (2): makeOrderEl\(\), pickColor\(\)

### Community 148 - "Dastbadast Multivendor Admin Map View — Key"
Cohesion (entity basis within full-graph community): 1
Nodes (2): makeRouteKey\(\), r\(\)

### Community 149 - "Dastbadast Multivendor API Migrate Geo Index"
Cohesion (entity basis within full-graph community): 1
Nodes (1): run\(\)

### Community 150 - "Dastbadast Multivendor API Order — Auto"
Cohesion (entity basis within full-graph community): 1
Nodes (2): autoConfirmIfExpired\(\), refreshOrderStatus\(\)

### Community 151 - "Dastbadast Multivendor Rider Order ID"
Cohesion (entity basis within full-graph community): 1
Nodes (1): ChatScreen\(\)

### Community 152 - "Dastbadast Multivendor Admin Orders"
Cohesion (entity basis within full-graph community): 1
Nodes (2): OrdersPage\(\), EmptyState\(\)

### Community 153 - "Dastbadast Multivendor Web Page — Cart"
Cohesion (entity basis within full-graph community): 1
Nodes (2): CartInner\(\), CartPage\(\)

### Community 154 - "Dastbadast Multivendor Admin Page — Card"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ChurnCard\(\), Row\(\)

### Community 155 - "Dastbadast Multivendor Admin Page — Card \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): CohortHeatmapCard\(\), colorForRetention\(\)

### Community 156 - "Dastbadast Multivendor Admin Page — Cohorts \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): CohortsInner\(\), colorForRetention\(\)

### Community 157 - "Dastbadast Multivendor Admin Page — Card \(3\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ForecastCard\(\), MetricChip\(\)

### Community 158 - "Dastbadast Multivendor Web Page — Help"
Cohesion (entity basis within full-graph community): 1
Nodes (2): HelpPage\(\), Step\(\)

### Community 159 - "Dastbadast Multivendor Web Page — Phone"
Cohesion (entity basis within full-graph community): 1
Nodes (2): isValidTJPhone\(\), validatePhone\(\)

### Community 160 - "Dastbadast Multivendor Admin Page — Detail"
Cohesion (entity basis within full-graph community): 1
Nodes (2): LTVStat\(\), UserDetailModal\(\)

### Community 161 - "Dastbadast Multivendor Admin Page — Map \(2\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): MapInner\(\), MapPageContent\(\)

### Community 162 - "Dastbadast Multivendor Admin Page — Map \(3\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): MapPageWithSubscriptions\(\), updateRiderPosition\(\)

### Community 163 - "Dastbadast Multivendor Web Page — Avatar \(3\)"
Cohesion (entity basis within full-graph community): 1
Nodes (2): onRemoveAvatar\(\), removeAvatar\(\)

### Community 164 - "Dastbadast Multivendor Web Product Of The Day"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ProductOfTheDay\(\), scrollBy\(\)

### Community 165 - "Dastbadast Multivendor Rider Profile Modal"
Cohesion (entity basis within full-graph community): 1
Nodes (1): ProfileModal\(\)

### Community 166 - "Dastbadast Multivendor API Recommend Indexes"
Cohesion (entity basis within full-graph community): 1
Nodes (1): run\(\)

### Community 167 - "Dastbadast Multivendor API Rider Subscriptions"
Cohesion (entity basis within full-graph community): 1
Nodes (1): currentRiderLocation\(\)

### Community 168 - "Dastbadast Multivendor API Scalars"
Cohesion (entity basis within full-graph community): 1
Nodes (1): parseLiteral\(\)

### Community 169 - "Dastbadast Multivendor Web Soft Shell"
Cohesion (entity basis within full-graph community): 1
Nodes (2): ShellLayout\(\), SoftShell\(\)

### Community 170 - "Dastbadast Multivendor Store Status Pill"
Cohesion (entity basis within full-graph community): 1
Nodes (1): StatusPill\(\)

### Community 171 - "Dastbadast Multivendor Admin Top Bar — Badge"
Cohesion (entity basis within full-graph community): 1
Nodes (1): RoleBadge\(\)

### Community 172 - "Dastbadast Multivendor Web Use Food Modifiers"
Cohesion (entity basis within full-graph community): 1
Nodes (1): useFoodModifiers\(\)

### Community 173 - "Dastbadast Multivendor Web App"
Cohesion (entity basis within full-graph community): 1
Nodes (1): page /

### Community 174 - "Dastbadast Multivendor Web App — Cart"
Cohesion (entity basis within full-graph community): 1
Nodes (1): page /cart

### Community 175 - "Dastbadast Multivendor Web App — Help"
Cohesion (entity basis within full-graph community): 1
Nodes (1): page /help

### Community 176 - "Dastbadast Multivendor Admin Zone Editor Map"
Cohesion (entity basis within full-graph community): 1
Nodes (1): ZoneEditorMap\(\)

### Community 177 - "Android Icon Background Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 178 - "Android Icon Foreground Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 179 - "Android Icon Monochrome Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 180 - "Babel Config Js"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 181 - "Declarations D TypeScript"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 182 - "Ecosystem Config Js"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 183 - "Explore Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 184 - "Explore 2x Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 185 - "Explore 3x Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 186 - "Expo Badge Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 187 - "Expo Badge White Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 188 - "Expo Env D TypeScript"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 189 - "Expo Logo Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 190 - "Expo Symbol 2 SVG"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 191 - "Favicon Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 192 - "Grid Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 193 - "Home 2x Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 194 - "Home 3x Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 195 - "Icon Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 196 - "Logo Glow Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 197 - "Metro Config Js"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 198 - "Next Config Js"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 199 - "Next Env D TypeScript"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 200 - "Postcss Config Js"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 201 - "React Logo Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 202 - "React Logo 2x Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 203 - "React Logo 3x Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 204 - "Splash Icon Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 205 - "Tailwind Config Js"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

### Community 206 - "Tutorial Web Png"
Cohesion (entity basis within full-graph community): n/a
Nodes (0): 

## Knowledge Gaps
- **393 weakly connected node(s):** `formatDateForInput\(\)`, `formatNumber\(\)`, `formatCurrency\(\)`, `SecondaryMetric\(\)`, `page /accounting` (+388 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Dastbadast Multivendor Web Address Picker — Address`** (2 nodes): `AddressPicker\(\)`, `applyPick\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Auth`** (2 nodes): `signRestaurantToken\(\)`, `restaurantLogin\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Auth — Rider`** (2 nodes): `signRiderToken\(\)`, `riderLogin\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Auth Required`** (2 nodes): `AuthRequired.tsx`, `AuthRequired\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Cache — Build`** (2 nodes): `buildCacheKey\(\)`, `hashQuery\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Cart — Cart`** (2 nodes): `cartItemKey\(\)`, `mergeCartItems\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Cart — Cart \(2\)`** (2 nodes): `saveCart\(\)`, `validateAndPriceItems\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Cart Debug Panel`** (2 nodes): `CartDebugPanel.tsx`, `CartDebugPanel\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Cleanup Empty Users`** (2 nodes): `cleanup-empty-users.js`, `run\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Delivery Subscriptions`** (2 nodes): `delivery-subscriptions.js`, `pubsub.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Rider Edit Profile — Edit`** (2 nodes): `edit-profile.tsx`, `Field\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Geo — Bearing`** (2 nodes): `bearingDeg\(\)`, `toRad\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API In Memory — Js`** (2 nodes): `in-memory.js`, `.publish\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Map View — Route`** (2 nodes): `fetchOSRMRoute\(\)`, `getRoute\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Map View — Color`** (2 nodes): `makeOrderEl\(\)`, `pickColor\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Map View — Key`** (2 nodes): `makeRouteKey\(\)`, `r\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Migrate Geo Index`** (2 nodes): `migrate-geo-index.js`, `run\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Order — Auto`** (2 nodes): `autoConfirmIfExpired\(\)`, `refreshOrderStatus\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Rider Order ID`** (2 nodes): `\[orderId\].tsx`, `ChatScreen\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Orders`** (2 nodes): `OrdersPage\(\)`, `EmptyState\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Page — Cart`** (2 nodes): `CartInner\(\)`, `CartPage\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Page — Card`** (2 nodes): `ChurnCard\(\)`, `Row\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Page — Card \(2\)`** (2 nodes): `CohortHeatmapCard\(\)`, `colorForRetention\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Page — Cohorts \(2\)`** (2 nodes): `CohortsInner\(\)`, `colorForRetention\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Page — Card \(3\)`** (2 nodes): `ForecastCard\(\)`, `MetricChip\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Page — Help`** (2 nodes): `HelpPage\(\)`, `Step\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Page — Phone`** (2 nodes): `isValidTJPhone\(\)`, `validatePhone\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Page — Detail`** (2 nodes): `LTVStat\(\)`, `UserDetailModal\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Page — Map \(2\)`** (2 nodes): `MapInner\(\)`, `MapPageContent\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Page — Map \(3\)`** (2 nodes): `MapPageWithSubscriptions\(\)`, `updateRiderPosition\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Page — Avatar \(3\)`** (2 nodes): `onRemoveAvatar\(\)`, `removeAvatar\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Product Of The Day`** (2 nodes): `ProductOfTheDay\(\)`, `scrollBy\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Rider Profile Modal`** (2 nodes): `ProfileModal.tsx`, `ProfileModal\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Recommend Indexes`** (2 nodes): `recommend-indexes.js`, `run\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Rider Subscriptions`** (2 nodes): `rider-subscriptions.js`, `currentRiderLocation\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor API Scalars`** (2 nodes): `scalars.js`, `parseLiteral\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Soft Shell`** (2 nodes): `ShellLayout\(\)`, `SoftShell\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Store Status Pill`** (2 nodes): `StatusPill.tsx`, `StatusPill\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Top Bar — Badge`** (2 nodes): `TopBar.tsx`, `RoleBadge\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web Use Food Modifiers`** (2 nodes): `useFoodModifiers.ts`, `useFoodModifiers\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web App`** (2 nodes): `page /`, `/`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web App — Cart`** (2 nodes): `page /cart`, `/cart`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Web App — Help`** (2 nodes): `page /help`, `/help`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dastbadast Multivendor Admin Zone Editor Map`** (2 nodes): `ZoneEditorMap.tsx`, `ZoneEditorMap\(\)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Android Icon Background Png`** (1 nodes): `android-icon-background.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Android Icon Foreground Png`** (1 nodes): `android-icon-foreground.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Android Icon Monochrome Png`** (1 nodes): `android-icon-monochrome.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Babel Config Js`** (1 nodes): `babel.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Declarations D TypeScript`** (1 nodes): `declarations.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ecosystem Config Js`** (1 nodes): `ecosystem.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Explore Png`** (1 nodes): `explore.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Explore 2x Png`** (1 nodes): `explore@2x.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Explore 3x Png`** (1 nodes): `explore@3x.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expo Badge Png`** (1 nodes): `expo-badge.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expo Badge White Png`** (1 nodes): `expo-badge-white.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expo Env D TypeScript`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expo Logo Png`** (1 nodes): `expo-logo.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expo Symbol 2 SVG`** (1 nodes): `expo-symbol 2.svg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Favicon Png`** (1 nodes): `favicon.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Grid Png`** (1 nodes): `grid.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home 2x Png`** (1 nodes): `home@2x.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home 3x Png`** (1 nodes): `home@3x.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Icon Png`** (1 nodes): `icon.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Logo Glow Png`** (1 nodes): `logo-glow.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Metro Config Js`** (1 nodes): `metro.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config Js`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Env D TypeScript`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Postcss Config Js`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Logo Png`** (1 nodes): `react-logo.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Logo 2x Png`** (1 nodes): `react-logo@2x.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Logo 3x Png`** (1 nodes): `react-logo@3x.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Splash Icon Png`** (1 nodes): `splash-icon.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config Js`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tutorial Web Png`** (1 nodes): `tutorial-web.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does \`Row\(\)\` connect \`Dastbadast Multivendor Admin Page — Card\` to \`Dastbadast Multivendor Web Page\`, \`Dastbadast Multivendor Client Cart — Bar\`, \`Dastbadast Multivendor Client ID — Countdown\`, \`Dastbadast Multivendor Web Page — Countdown\`, \`Dastbadast Multivendor Web Cart Drawer\`?**
  _High betweenness centrality \(21740.468\) - this node is a cross-community bridge._
- **Why does \`EmptyState\(\)\` connect \`Dastbadast Multivendor Admin Orders\` to \`Dastbadast Multivendor Admin Page — Format\`, \`Dastbadast Multivendor Web Page\`, \`Dastbadast Multivendor Client Address\`, \`Dastbadast Multivendor Client Cart — Bar\`, \`Dastbadast Multivendor Client Home\`, \`Dastbadast Multivendor Client ID — Chip\`, \`Dastbadast Multivendor Store Menu\`, \`Dastbadast Multivendor Store New\`, \`Dastbadast Multivendor Store Processing\`?**
  _High betweenness centrality \(20907.399\) - this node is a cross-community bridge._
- **Why does \`CartDrawer\(\)\` connect \`Dastbadast Multivendor Web Cart Drawer\` to \`Dastbadast Multivendor Admin Page — Card\`, \`Dastbadast Multivendor Web Top Header\`?**
  _High betweenness centrality \(18271.216\) - this node is a cross-community bridge._
- **What connects \`formatDateForInput\(\)\`, \`formatNumber\(\)\`, \`formatCurrency\(\)\` to the rest of the system?**
  _393 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should \`Dastbadast Multivendor API Admin\` be split into smaller, more focused modules?**
  _Cohesion score 0.07 across 27 entity nodes - this community may mix unrelated responsibilities._
