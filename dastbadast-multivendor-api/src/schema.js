export const typeDefs = /* GraphQL */ `
  scalar JSON
  scalar DateTime

  type DeliveryPriceBreakdown {
    base: Float!
    perKm: Float!
    distanceKm: Float!
    total: Float!
    isOverBase: Boolean!
  }

  # ⭐ ФИКС: тип возврата для estimateDelivery — резолвер (resolvers/cart.js)
  # уже возвращал этот набор полей, но в схеме типа не было вовсе, из-за чего
  # сервер падал при старте: "Query.estimateDelivery defined in resolvers,
  # but not in schema".
  type EstimateDeliveryResult {
    available: Boolean!
    deliveryPrice: Float
    breakdown: DeliveryPriceBreakdown
    currency: String
    currencySymbol: String
    error: String
  }

  type Configuration {
    currency: String
    currencySymbol: String
    deliveryRate: Float
    taxPercent: Float
    deliveryBaseKm: Float
    deliveryBasePrice: Float
    deliveryPerKmPrice: Float
    skipEmailVerification: Boolean
    skipMobileVerification: Boolean
    testOtp: String
  }

  type Zone {
    id: ID!
    name: String
    description: String
    isActive: Boolean
    polygon: JSON
  }

  type DeliveryZone {
    id: ID!
    name: String
    description: String
    polygon: JSON!
  }

  type Address {
    id: ID!
    label: String
    address: String
    city: String
    details: String
    location: JSON
    isSelected: Boolean
  }

  type User {
    id: ID!
    name: String!
    email: String
    phone: String
    addresses: [Address!]
  }

  # ⭐ НОВОЕ: входные данные для обновления профиля клиента
  input UpdateUserInput {
    name: String
    email: String
    phone: String
  }

  input UpdateRestaurantInput {
    name: String
    address: String
    tax: Float
    minimumOrder: Float
    isAvailable: Boolean
    lat: Float
    lng: Float
  }

  input UpdateRiderInput {
    name: String
    phone: String
    email: String
    photo: String
    isActive: Boolean
    zoneId: ID
  }

  # Расширенный тип для админ-карточки пользователя
  type AdminUser {
    id: ID!
    name: String!
    email: String
    phone: String
    isActive: Boolean!
    createdAt: String!
    addressesCount: Int!
    totalOrders: Int!
    totalSpent: Float!
    avgOrderValue: Float
    lastOrderAt: String
  }

  type AdminUserList {
    total: Int!
    users: [AdminUser!]!
  }

  type AdminUserDetail {
    user: AdminUser!
    addresses: [Address!]!
    orders: [AdminUserOrder!]!
  }

  type AdminUserOrder {
    id: ID!
    orderId: String!
    orderStatus: String!
    total: Float!
    restaurantName: String!
    createdAt: String!
  }

  type ToggleUserResult {
    id: ID!
    isActive: Boolean!
  }

  input AdminUsersFilter {
    search: String
    limit: Int
    offset: Int
  }

  input CreateZoneInput {
    name: String!
    description: String
    polygon: JSON!
    isActive: Boolean
  }

  input UpdateZoneInput {
    name: String
    description: String
    polygon: JSON
    isActive: Boolean
  }

  type AuthPayload {
    token: String!
    user: User!
  }
  type AuthPayloadRestaurant {
    token: String!
    restaurant: Restaurant!
  }
  type AuthPayloadOwner {
    token: String!
    owner: Owner!
  }
  type AuthPayloadRider {
    token: String!
    rider: Rider!
  }

  type Owner {
    id: ID!
    email: String!
    userType: String
    permissions: OwnerPermissions
    isActive: Boolean!
    lastLoginAt: String
    createdAt: String!
  }

  type OwnerPermissions {
    canManageRestaurants: Boolean!
    canManageRiders: Boolean!
    canManageZones: Boolean!
    canManageConfiguration: Boolean!
    canViewAccounting: Boolean!
    canAssignRiders: Boolean!
    canManageUsers: Boolean!
  }

  input OwnerPermissionsInput {
    canManageRestaurants: Boolean
    canManageRiders: Boolean
    canManageZones: Boolean
    canManageConfiguration: Boolean
    canViewAccounting: Boolean
    canAssignRiders: Boolean
    canManageUsers: Boolean
  }

  input CreateOwnerInput {
    email: String!
    password: String!
    userType: String!
    permissions: OwnerPermissionsInput
  }

  input UpdateOwnerInput {
    email: String
    userType: String
    permissions: OwnerPermissionsInput
    isActive: Boolean
  }

  input CreateUserInput {
    name: String!
    email: String
    phone: String
    password: String!
  }
  input LoginInput {
    email: String
    phone: String
    password: String!
  }
  input LoginRestaurantInput {
    username: String!
    password: String!
  }
  input LoginOwnerInput {
    email: String!
    password: String!
  }
  input LoginRiderInput {
    username: String!
    password: String!
  }
  input CreateRiderInput {
    username: String!
    password: String!
    name: String
    phone: String
    zoneId: ID
  }

  type Rider {
    id: ID!
    username: String!
    name: String
    phone: String
    email: String
    photo: String
    available: Boolean!
    location: JSON
    lastLocationAt: String
    bearing: Float
    zoneId: ID
    isActive: Boolean!
    balance: Float!
    averageRating: Float!
    totalRatings: Int!
    totalDeliveries: Int!
    # ratings — не возвращаем в общем списке (там могут быть тысячи).
    # Если нужны — отдельный query.
  }

  type RiderRating {
    id: ID!
    score: Int!
    orderId: ID
    comment: String
    ratedAt: String!
  }

  input UpdateRiderProfileInput {
    name: String
    phone: String
    email: String
    photo: String
  }

  input ChangeRiderPasswordInput {
    oldPassword: String!
    newPassword: String!
  }

  type RiderFinancials {
    riderId: ID!
    riderName: String!
    phone: String
    # ⭐ Текущий баланс
    balance: Float!
    # ⭐ Заработано всего (за всё время)
    totalEarned: Float!
    # Доставлено всего
    totalDeliveries: Int!
    # Средний чек доставки
    averageDeliveryFee: Float!
  }

  input AddressInput {
    label: String
    address: String!
    city: String
    details: String
    location: JSON!
  }

  type Restaurant {
    id: ID!
    name: String!
    slug: String
    image: String
    address: String
    location: JSON
    zoneId: ID
    isAvailable: Boolean
    minimumOrder: Float
    tax: Float
    workingHours: WorkingHours
    isOpenNow: Boolean # computed-поле
    categories: [Category!]
  }

  type WorkingHours {
    open: String
    close: String
    isAlwaysOpen: Boolean
  }

  input WorkingHoursInput {
    open: String
    close: String
    isAlwaysOpen: Boolean
  }

  input UpdateMyRestaurantInput {
    minimumOrder: Float
    isAvailable: Boolean
    workingHours: WorkingHoursInput
  }

  type Category {
    id: ID!
    title: String!
    image: String
    foods: [Food!]
  }

  type FoodOption {
    id: ID!
    title: String!
    price: Float!
    isAvailable: Boolean!
  }

  type FoodOptionGroup {
    id: ID!
    title: String!
    required: Boolean!
    multiple: Boolean!
    minSelect: Int!
    maxSelect: Int!
    sortOrder: Int!
    options: [FoodOption!]!
  }

  type Food {
    id: ID!
    title: String!
    description: String
    image: String
    price: Float
    isActive: Boolean
    isAvailable: Boolean
    averageRating: Float
    reviewCount: Int
    reviews: [FoodReview!]
    optionGroups: [FoodOptionGroup!]!
    isVegetarian: Boolean
    isVegan: Boolean
    spiceLevel: Int
    allergens: [String!]
  }

  input FoodOptionInput {
    id: ID # передайте, если редактируете существующую опцию — иначе создастся новая
    title: String!
    price: Float!
    isAvailable: Boolean
  }

  input FoodOptionGroupInput {
    id: ID
    title: String!
    required: Boolean
    multiple: Boolean
    minSelect: Int
    maxSelect: Int
    sortOrder: Int
    options: [FoodOptionInput!]!
  }

  input FoodInput {
    categoryId: ID!
    title: String!
    description: String
    price: Float!
    image: String
    averageRating: Int
    reviewCount: Int
    restaurantId: ID
    restaurantName: String
    isVegetarian: Boolean
    isVegan: Boolean
    spiceLevel: Int
    allergens: [String!]
  }

  type OrderItemOption {
    groupId: ID!
    groupTitle: String!
    optionId: ID!
    optionTitle: String!
    price: Float!
  }

  type FoodReview {
    id: ID!
    foodId: ID!
    userName: String
    rating: Int!
    comment: String!
    createdAt: String!
  }

  type CartItemOption {
    groupId: ID!
    groupTitle: String!
    optionId: ID!
    optionTitle: String!
    price: Float!
  }

  type CartItem {
    foodId: ID!
    title: String!
    image: String
    description: String
    # Цены — снапшот (Шаг 1)
    basePrice: Float!
    optionsTotal: Float!
    price: Float!
    # Состав
    quantity: Int!
    selectedOptions: [CartItemOption!]!
    lineTotal: Float!
  }

  type Cart {
    id: ID!
    userId: ID!
    restaurantId: ID
    restaurantName: String
    items: [CartItem!]!
    # ⭐ Производные поля (вычисляются в resolver)
    subtotal: Float!
    itemCount: Int!
    updatedAt: String!
  }

  # Inputs
  input CartItemOptionInput {
    groupId: ID!
    optionId: ID!
  }

  input AddFoodReviewInput {
    foodId: ID!
    rating: Int!
    comment: String!
  }

  enum OrderStatus {
    PENDING
    ACCEPTED
    PREPARING
    READY_FOR_PICKUP
    ASSIGNED
    PICKED
    EN_ROUTE_TO_DROP_OFF
    ARRIVED_AT_DROP_OFF
    DELIVERED
    CANCELLED
    AWAITING_CONFIRMATION
  }
  enum PaymentMethod {
    COD
    ALIF_MOBI
    DS_BANK
  }

  type OrderItem {
    foodId: ID
    title: String!
    basePrice: Float! # ⭐ ШАГ 1: было просто price
    optionsTotal: Float! # ⭐ ШАГ 1: Σ(надбавки) по выбранным опциям
    price: Float! # ⭐ ШАГ 1: ИТОГО за единицу (basePrice + optionsTotal)
    quantity: Int!
    image: String
    description: String
    # ⭐⭐⭐ ШАГ 1: заменили variation+addons на структурированный список
    selectedOptions: [OrderItemOption!]!
    lineTotal: Float! # ⭐⭐⭐ ШАГ 1: price × quantity (виртуальное)
  }

  input OrderItemOptionInput {
    groupId: ID!
    optionId: ID!
  }

  type OrderAmounts {
    subtotal: Float!
    tax: Float!
    deliveryFee: Float!
    total: Float!
  }
  type DeliveryAddress {
    label: String
    address: String!
    city: String
    details: String
    location: JSON!
  }
  type PickupAddress {
    name: String
    address: String!
    city: String
    location: JSON
  }
  type StatusTimestamps {
    pendingAt: String
    acceptedAt: String
    assignedAt: String
    pickedAt: String
    deliveredAt: String
    cancelledAt: String
    prepTime: Int
    courierSearchTimestamps: CourierSearchTimestamps
  }
  type CourierSearchTimestamps {
    initialPushedAt: String
    escalationPushedAt: String
  }

  type Order {
    id: ID!
    orderId: String!
    userId: ID!
    restaurantId: ID!
    riderId: ID
    items: [OrderItem!]!
    orderStatus: OrderStatus!
    paymentMethod: PaymentMethod!
    paid: Boolean!
    paidAt: String
    paymentStatus: String
    providerRef: String
    deliveryAddress: DeliveryAddress!
    pickupAddress: PickupAddress
    note: String
    amounts: OrderAmounts!
    statusTimestamps: StatusTimestamps
    cancelReason: String
    createdAt: String!
    updatedAt: String!
    deliveryPrice: Float
    deliveryBreakdown: DeliveryPriceBreakdown
    routeGeometry: JSON
    routeDistanceKm: Float
    etaToCustomer: Int
    riderLocation: RiderLocation
  }

  type RiderLocation {
    lat: Float!
    lng: Float!
    updatedAt: String!
  }

  input OrderItemInput {
    foodId: ID!
    quantity: Int!
    # ⭐⭐⭐ ШАГ 1: выбранные опции (массив ссылок groupId+optionId)
    selectedOptions: [OrderItemOptionInput!]
  }

  input PlaceOrderInput {
    restaurantId: ID!
    addressId: ID!
    items: [OrderItemInput!]!
    paymentMethod: PaymentMethod = COD
    note: String
    idempotencyKey: String
    deliveryPrice: Float
  }
  input AcceptOrderInput {
    orderId: ID!
    prepTime: Int
  }
  input CancelOrderInput {
    orderId: ID!
    reason: String
  }
  input AssignRiderInput {
    orderId: ID!
    riderId: ID!
  }
  input UpdateOrderStatusRiderInput {
    orderId: ID!
    status: OrderStatus!
  }
  input ConfirmOrderInput {
    orderId: ID!
  }
  input RiderLocationInput {
    lng: Float!
    lat: Float!
    bearing: Float
  }
  input CreateRestaurantInput {
    name: String!
    slug: String
    address: String!
    city: String
    username: String!
    password: String!
    tax: Float
    minimumOrder: Float
    lng: Float!
    lat: Float!
  }
  input CreateCategoryInput {
    title: String!
    image: String
  }
  input UpdateCategoryInput {
    title: String
    image: String
  }
  input CreateFoodInput {
    categoryId: ID!
    title: String!
    description: String
    image: String
    price: Float!
    isVegetarian: Boolean
    isVegan: Boolean
    spiceLevel: Int
    allergens: [String!]
    optionGroups: [FoodOptionGroupInput!]
  }
  input UpdateFoodInput {
    categoryId: ID
    title: String
    description: String
    image: String
    price: Float
    isAvailable: Boolean
    isActive: Boolean
    isVegetarian: Boolean
    isVegan: Boolean
    spiceLevel: Int
    allergens: [String!]
    optionGroups: [FoodOptionGroupInput!]
  }

  input ConfigurationInput {
    currency: String
    currencySymbol: String
    deliveryRate: Float
    taxPercent: Float
    deliveryBaseKm: Float
    deliveryBasePrice: Float
    deliveryPerKmPrice: Float
    testOtp: String
  }

  type RiderLocationUpdate {
    riderId: ID!
    lat: Float!
    lng: Float!
    updatedAt: String!
  }

  type ChatMessage {
    id: ID!
    orderId: ID!
    senderType: String!
    text: String!
    createdAt: String!
  }

  type AdminAccounting {
    totalRevenue: Float!
    totalDelivered: Int!
    totalCommission: Float!
    restaurants: [RestaurantAccounting!]!
    riders: [RiderAccounting!]!
  }
  type RestaurantAccounting {
    restaurantId: ID!
    restaurantName: String!
    orderCount: Int!
    revenue: Float!
    commission: Float!
    payout: Float!
  }
  type RiderAccounting {
    riderId: ID!
    riderName: String!
    phone: String
    deliveredCount: Int!
    totalEarnings: Float!
  }

  type DashboardToday {
    orders: Int!
    delivered: Int!
    cancelled: Int!
    revenue: Float!
  }

  type DashboardLive {
    activeOrders: Int!
    activeRiders: Int!
    restaurantsOnline: Int!
  }

  type DashboardChartPoint {
    date: String!
    count: Int!
    revenue: Float!
  }

  type TopRestaurant {
    restaurantId: ID!
    name: String!
    orderCount: Int!
    revenue: Float!
  }

  type TopRider {
    riderId: ID!
    name: String!
    deliveredCount: Int!
    earnings: Float!
  }

  type AdminDashboard {
    today: DashboardToday!
    live: DashboardLive!
    newUsersToday: Int!
    chart7Days: [DashboardChartPoint!]!
    topRestaurants: [TopRestaurant!]!
    topRiders: [TopRider!]!
  }

  type CourierSearchEvent {
    orderId: ID!
    orderIdStr: String!
    restaurantName: String!
    restaurantLocation: JSON
    riderIds: [String!]!
    radiusKm: Float!
    escalation: Boolean!
    fastAcceptBonus: Float!
    createdAt: String!
  }

  # ⭐⭐⭐ NEW: событие входа курьера в geofence "рядом с клиентом"
  type RiderNearDropOffEvent {
    orderId: ID!
    riderId: ID!
    distanceM: Int!
    timestamp: String!
  }

  type DeliveryEvent {
    order: Order!
    etaToRestaurant: Int
    etaToCustomer: Int
    event: String!
  }

  # ============================================================
  # ⭐ Push-токены (Раздел 3 — Expo Push Notifications)
  # ============================================================
  type PushToken {
    id: ID!
    ownerType: String!
    platform: String!
    locale: String
    lastUsedAt: String
    createdAt: String!
  }

  input PushTokenInput {
    token: String!
    platform: String!
    locale: String
  }

  input SaveCartInput {
    restaurantId: ID
    items: [CartItemInput!]!
  }

  input CartItemInput {
    foodId: ID!
    quantity: Int!
    basePrice: Float!
    optionsTotal: Float!
    price: Float!
    selectedOptions: [CartItemOptionInput!]!
  }

  input CartItemOptionInput {
    groupId: ID!
    optionId: ID!
  }

  input UpdateRestaurantInput {
    name: String
    address: String
    tax: Float
    minimumOrder: Float
    isAvailable: Boolean
    lat: Float
    lng: Float
  }

  type RiderFinancials {
    riderId: ID!
    riderName: String!
    balance: Float!
    totalEarned: Float!
    totalDeliveries: Int!
    averageDeliveryFee: Float!
  }

  type UserLTV {
    userId: ID!
    orderCount: Int!
    totalSpent: Float!
    avgOrderValue: Float!
    cancelledCount: Int!
    firstOrderAt: String
    lastOrderAt: String
    activeDays: Int!
    predictedAnnualLTV: Float
    isPredictionReliable: Boolean!
  }

  type UserOrderFrequency {
    userId: ID!
    totalOrders: Int!
    deliveredOrders: Int!
    cancelledOrders: Int!
    avgIntervalDays: Float!
    medianIntervalDays: Float!
    ordersPerWeek: Float!
    ordersPerMonth: Float!
    longestGapDays: Float!
    status: String! # "active" | "churned" | "new"
    daysSinceLastOrder: Int
    cohortMonth: String
  }

  type CohortRow {
    month: String!
    totalUsers: Int!
    retentionByMonth: [Float!]!
  }

  type CohortResult {
    cohorts: [CohortRow!]!
    months: Int!
  }

  type ChurnRate {
    period: Int!
    activeAtStart: Int!
    churned: Int!
    retained: Int!
    churnRatePct: Float!
    retentionRatePct: Float!
    avgOrdersPerRetained: Float!
  }

  type DailyRevenuePoint {
    date: String!
    revenue: Float!
    orders: Int!
  }

  type ForecastPoint {
    date: String!
    predictedRevenue: Float!
    predictedOrders: Int!
    isForecast: Boolean!
  }

  type DemandForecast {
    history: [DailyRevenuePoint!]!
    forecast: [ForecastPoint!]!
    totals: DemandForecastTotals!
  }

  type DemandForecastTotals {
    avgDailyRevenue: Float!
    avgDailyOrders: Float!
    totalForecastRevenue: Float!
    trendPct: Float!
  }

  type Query {
    configuration: Configuration
    deliveryZone: DeliveryZone
    restaurantPrepEta(orderId: ID!): Int
    restaurants(zoneId: ID): [Restaurant!]!
    restaurant(id: ID!): Restaurant
    foodReviews(foodId: ID!): [FoodReview!]!
    profile: User
    addresses: [Address!]!
    selectedAddress: Address
    orders: [Order!]!
    order(id: ID!): Order
    restaurantOrders(status: OrderStatus): [Order!]!
    meRestaurant: Restaurant
    adminUsers(filter: AdminUsersFilter): AdminUserList!
    adminUserDetail(id: ID!): AdminUserDetail!
    allOrders(status: OrderStatus): [Order!]!
    owners: [Owner!]!
    owner(id: ID!): Owner
    riders(available: Boolean): [Rider!]!
    meOwner: Owner
    meRider: Rider
    riderOrders(status: OrderStatus): [Order!]!
    availableOrdersForRiders: [Order!]!
    rider(id: ID!): Rider
    chatMessages(orderId: ID!): [ChatMessage!]!
    adminAccounting(from: String, to: String): AdminAccounting!
    zones: [Zone!]!
    zone(id: ID!): Zone
    adminDashboardMetrics: AdminDashboard!
    currentRiderLocation(riderId: ID!): RiderLocationUpdate
    myPushTokens: [PushToken!]!
    calculateDeliveryPrice(fromCoords: JSON!, toCoords: JSON!): Float!
    calculateDeliveryPriceBreakdown(
      fromCoords: JSON!
      toCoords: JSON!
      basePrice: Float
      baseKm: Float
      perKmPrice: Float
    ): DeliveryPriceBreakdown
    getCart: Cart
    estimateDelivery(restaurantId: ID!, addressId: ID!): EstimateDeliveryResult!
    riderFinancials(riderId: ID!): RiderFinancials!
    allRidersWithLocation: [Rider!]!
    ordersForMap(status: OrderStatus): [Order!]!
    riderLocationOnMap(riderId: ID!): RiderLocation
    userLTV(userId: ID!): UserLTV
    userOrderFrequency(userId: ID!): UserOrderFrequency
    userCohorts(months: Int): CohortResult!
    churnRate(period: Int): ChurnRate!
    demandForecast(days: Int): DemandForecast!
  }

  type Mutation {
    createUser(input: CreateUserInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createAddress(input: AddressInput!): Address!
    editAddress(id: ID!, input: AddressInput!): Address!
    deleteAddress(id: ID!): Boolean!
    selectAddress(id: ID!): Address!
    placeOrder(input: PlaceOrderInput!): Order!
    addFoodReview(input: AddFoodReviewInput!): FoodReview!
    restaurantLogin(input: LoginRestaurantInput!): AuthPayloadRestaurant!
    acceptOrder(input: AcceptOrderInput!): Order!
    cancelOrder(input: CancelOrderInput!): Order!
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
    createFood(input: CreateFoodInput!): Food!
    updateFood(id: ID!, input: UpdateFoodInput!): Food!
    deleteFood(id: ID!): Boolean!
    ownerLogin(input: LoginOwnerInput!): AuthPayloadOwner!
    createRider(input: CreateRiderInput!): Rider!
    createRestaurant(input: CreateRestaurantInput!): Restaurant!
    assignRider(input: AssignRiderInput!): Order!
    riderLogin(input: LoginRiderInput!): AuthPayloadRider!
    claimOrder(orderId: ID!): Order!
    updateOrderStatusRider(input: UpdateOrderStatusRiderInput!): Order!
    confirmOrderReceived(input: ConfirmOrderInput!): Order!
    refreshOrderStatus(id: ID!): Order! # ← ДОБАВЬ
    updateRiderLocation(input: RiderLocationInput!): Rider!
    toggleRider(available: Boolean!): Rider!
    updateRiderProfile(input: UpdateRiderProfileInput!): Rider!
    changeRiderPassword(input: ChangeRiderPasswordInput!): Boolean!
    updateConfiguration(input: ConfigurationInput!): Configuration!
    sendChatMessage(orderId: ID!, text: String!): ChatMessage!
    createOwner(input: CreateOwnerInput!): Owner!
    updateOwner(id: ID!, input: UpdateOwnerInput!): Owner!
    deactivateOwner(id: ID!): Boolean!
    resetOwnerPassword(id: ID!, newPassword: String!): Boolean!
    toggleUserActive(id: ID!, isActive: Boolean!): ToggleUserResult!
    createZone(input: CreateZoneInput!): Zone!
    updateZone(id: ID!, input: UpdateZoneInput!): Zone!
    deleteZone(id: ID!): Boolean!
    # ⭐ НОВОЕ: обновление профиля клиента (имя / email / телефон)
    updateUser(input: UpdateUserInput!): User!
    # Ресторан: переходы по кухн и прочее
    markOrderPreparing(orderId: ID!): Order!
    markOrderReady(orderId: ID!): Order!
    # Курьер: приеять и доставлять заказ
    acceptDelivery(orderId: ID!): Order!
    pickupDelivery(orderId: ID!): Order!
    arriveAtDropOff(orderId: ID!): Order!
    markDelivered(orderId: ID!): Order!
    updateRestaurant(id: ID!, input: UpdateRestaurantInput!): Restaurant!
    updateRider(id: ID!, input: UpdateRiderInput!): Rider!
    toggleRiderActive(id: ID!, isActive: Boolean!): Rider!
    stopRiderLocationStream: Boolean!
    registerPushToken(input: PushTokenInput!): PushToken!
    unregisterPushToken(token: String!): Boolean!
    saveCart(input: SaveCartInput!): Cart!
    updateMyRestaurant(input: UpdateMyRestaurantInput!): Restaurant!
  }

  type Subscription {
    orderStatusChanged(userId: ID!): Order!
    subscriptionOrder(orderId: ID!): Order!
    # ⭐ ШАГ 4: расширенная подписка — возвращает ПОЛНЫЙ Order (а не обрезок).
    # Это нужно, чтобы UI обновлял ETA, расстояние, чекаут одним событием.
    # По сути, дублирует тип Order — оставляем тот же Order для GraphQL-совместимости.
    subscribePlaceOrder(restaurantId: ID!): Order!
    subscriptionAssignedRider(riderId: ID!): Order!
    subscriptionZoneOrders(zoneId: ID): Order!
    subscriptionAvailableOrders(zoneId: ID): Order!
    subscriptionRiderLocation(riderId: ID!): RiderLocationUpdate!
    subscriptionRiderOrderCompleted(riderId: ID!): Order!
    newChatMessage(orderId: ID!): ChatMessage!
    courierSearchNotify: CourierSearchEvent!
    deliveryStatusChanged(orderId: ID!): DeliveryEvent!
    allDeliveries: Order!
    riderNearDropOff(orderId: ID!): RiderNearDropOffEvent!
    riderLocationStream(riderId: ID!): RiderLocation!
    allOrdersChanged: Order!
  }
`;
