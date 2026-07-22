// dastbadast-multivendor-api/src/schema.js
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
    waitCompensationFreeMinutes: Float
    waitCompensationPerMinute: Float
  }

  type Zone {
    id: ID!
    name: String
    description: String
    isActive: Boolean
    polygon: JSON
    # ⭐ Фаза 1 (аудит): см. models/Zone.js
    surgeMultiplier: Float
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
    nameChangesLeft: Int!
    nameChangeUnlocksAt: DateTime
    email: String
    emailVerifiedAt: DateTime
    pendingEmail: String
    phone: String
    pendingPhone: String
    hasPassword: Boolean!
    avatar: String
    avatarUnlocksAt: DateTime
    addresses: [Address!]
    balance: Float!
  }

  input UpdateUserInput {
    name: String
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
    surgeMultiplier: Float
  }

  input UpdateZoneInput {
    name: String
    description: String
    polygon: JSON
    isActive: Boolean
    surgeMultiplier: Float
  }

  enum OtpPurpose {
    REGISTER
    LOGIN
    RESET
  }

  type OtpResult {
    sent: Boolean!
    ttlSeconds: Int!
  }

  input SetPasswordInput {
    oldPassword: String # обязателен, только если пароль уже задан
    newPassword: String!
  }

  input ResetPasswordInput {
    phone: String!
    code: String!
    newPassword: String!
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
    name: String
    avatarUrl: String
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
    name: String
    avatarUrl: String
    permissions: OwnerPermissionsInput
  }

  input UpdateOwnerInput {
    email: String
    userType: String
    name: String
    avatarUrl: String
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
    declinedOrdersCount: Int
    lastDeclinedAt: String
    gpsAnomalyCount: Int
    lastGpsAnomalyAt: String
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
    averageRating: Float
    totalRatings: Int
    estimatedPrepMinutes: Int
    distanceKm: Float
    deliveryPriceEstimate: Float
    deliveryTime: Int
    isFavorite: Boolean
  }

  type MenuAvailabilityEvent {
    foodId: ID # null = изменился ресторан целиком, а не одно блюдо
    bulk: Boolean # true = менялись множество блюд
    restaurantId: ID!
    isAvailable: Boolean!
  }

  type DeliveryEtaInfo {
    distanceKm: Float!
    estimatedPrepMinutes: Int!
    estimatedDeliveryMinutes: Int! # = prep + (km / 25 km/h * 60) + 5 (handover)
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

  type RestaurantReview {
    id: ID!
    restaurantId: ID!
    userId: ID!
    userName: String
    rating: Int!
    comment: String!
    createdAt: String!
  }

  input AddRestaurantReviewInput {
    restaurantId: ID!
    rating: Int!
    comment: String!
    orderId: ID
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
    isFavorite: Boolean
    restaurantId: ID
    restaurantName: String
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
    # Цены — снапшот 
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
    BALANCE
  }

  type OrderItem {
    foodId: ID
    title: String!
    basePrice: Float!
    optionsTotal: Float!
    price: Float!
    quantity: Int!
    image: String
    description: String
    selectedOptions: [OrderItemOption!]!
    lineTotal: Float!
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
    # ⭐ Фаза 1 (аудит): см. models/Order.js
    surgeMultiplier: Float
    waitCompensation: Float
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
    restaurantAckedAt: String
    restaurantAckedVia: String
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
    # ⭐ Фаза 0 (аудит): антифрод-флаг markDelivered — см. resolvers/delivery.js
    deliveryLocationMismatch: Boolean
    deliveryLocationMismatchDistanceM: Int
    lastDeclineReason: String
  }

  type RiderLocation {
    lat: Float!
    lng: Float!
    updatedAt: String!
  }

  input OrderItemInput {
    foodId: ID!
    quantity: Int!
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
    reasonCode: String
  }

  input AckOrderReceivedInput {
    orderId: ID!
    via: OrderAckChannel = SUBSCRIPTION
  }
  enum OrderAckChannel {
    SUBSCRIPTION
    POLL
    PUSH
  }
  input AssignRiderInput {
    orderId: ID!
    riderId: ID!
  }
  """
  ⭐ Фаза 0 (аудит): курьер отказывается от УЖЕ назначенного заказа
  (orderStatus === ASSIGNED, т.е. до фактического pickupDelivery).
  """
  input DeclineAssignedOrderInput {
    orderId: ID!
    reason: String
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
    # ⭐ Фаза 1 (аудит): Android mock-location флаг из expo-location
    # (loc.mocked). Не блокирует отправку координат — сервер только
    # считает аномалии. См. resolvers/rider.js updateRiderLocation.
    mocked: Boolean
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
    waitCompensationFreeMinutes: Float
    waitCompensationPerMinute: Float
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
    imageUrl: String
    readAt: String
    createdAt: String!
  }

  type SupportThread {
    id: ID!
    participantType: String!
    participantId: ID!
    participantName: String
    orderId: ID
    subject: String
    status: String!
    assignedOwnerId: ID
    assignedOwnerEmail: String
    assignedOwnerName: String
    assignedOwnerAvatar: String
    participantAvatar: String
    lastMessageAt: String
    lastMessagePreview: String
    lastSenderType: String
    unreadForStaff: Boolean!
    unreadForParticipant: Boolean!
    staffReadAt: String
    participantReadAt: String
    closedByOwnerId: ID
    closedByName: String
    createdAt: String!
  }

  type SupportMessage {
    id: ID!
    threadId: ID!
    senderType: String!
    senderName: String
    senderAvatar: String
    text: String!
    imageUrl: String
    readByStaff: Boolean!
    readByParticipant: Boolean!
    createdAt: String!
  }

  type AdminAccounting {
    totalRevenue: Float!
    totalDelivered: Int!
    totalCommission: Float!
    totalCancellationFees: Float!
    restaurants: [RestaurantAccounting!]!
    riders: [RiderAccounting!]!
  }
  type RestaurantAccounting {
    restaurantId: ID!
    restaurantName: String!
    orderCount: Int!
    revenue: Float!
    commission: Float!
    commissionPercent: Float! # ⭐ ФАЗА 2 — видно, какой % применён именно к этому ресторану
    cancellationFees: Float!
    payout: Float!
  }
  type RestaurantAccountingRow {
    restaurantId: ID!
    restaurantName: String!
    orderCount: Int!
    revenue: Float!
    commission: Float!
    commissionPercent: Float! # ⭐ ФАЗА 2 — видно, какой % применён именно к этому ресторану
    cancellationFees: Float! # ⭐ ФАЗА 2
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
    # ⭐ Фаза 2 (аудит): подмножество riderIds, отобранное как
    # батчинг/стекинг-кандидаты (уже везут другой заказ по пути).
    stackedRiderIds: [String!]
    radiusKm: Float!
    escalation: Boolean!
    fastAcceptBonus: Float!
    createdAt: String!
  }

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

  type KitchenLoadInfo {
    queueLength: Int!
    avgActualPrepMin: Int
    suggestedPrepTime: Int!
    isBusy: Boolean!
  }

  type TypingStatusEvent {
    orderId: ID!
    senderType: String!
    isTyping: Boolean!
  }

  type ChatReadStatusEvent {
    orderId: ID!
    readerType: String!
    readAt: String!
  }

  type RiderOrderEarnings {
    orderId: ID!
    deliveryFee: Float!
    distanceKm: Float
    tip: Float
  }

  type RiderShiftEarnings {
    shiftStartedAt: String
    deliveriesCount: Int!
    totalEarned: Float!
    onlineMinutes: Int!
  }

  type RiderEarningsSummary {
    order: RiderOrderEarnings
    shift: RiderShiftEarnings!
  }

  input WebPushKeysInput {
    p256dh: String!
    auth: String!
  }

  input WebPushSubscriptionInput {
    endpoint: String!
    keys: WebPushKeysInput!
    userAgent: String
  }

  type BulkUpdateResult {
    modifiedCount: Int!
  }

  enum WalletOwnerType {
    RESTAURANT
    USER
    RIDER
  }

  type WalletTransaction {
    id: ID!
    ownerType: WalletOwnerType!
    type: String!
    amount: Float!
    balanceAfter: Float!
    note: String
    orderId: ID
    createdAt: String!
  }

  type Query {
    configuration: Configuration
    deliveryZone: DeliveryZone
    restaurantPrepEta(orderId: ID!): Int
    kitchenLoad: KitchenLoadInfo!
    restaurants(zoneId: ID, latitude: Float, longitude: Float): [Restaurant!]!
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
    mySupportThreads: [SupportThread!]!
    supportThread(id: ID!): SupportThread
    supportMessages(threadId: ID!): [SupportMessage!]!
    supportThreads(
      status: String
      assignedToMe: Boolean
      showAll: Boolean
      search: String
    ): [SupportThread!]!
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
    riderEarningsSummary(orderId: ID): RiderEarningsSummary!
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
    restaurantReviews(restaurantId: ID!, limit: Int): [RestaurantReview!]!
    restaurantDistance(id: ID!, addressId: ID!): Float
    restaurantDeliveryEta(id: ID!, addressId: ID!): DeliveryEtaInfo
    vapidPublicKey: String
    myFavoriteRestaurants: [Restaurant!]!
    myFavoriteFoods: [Food!]!
    myWalletTransactions(limit: Int, offset: Int): [WalletTransaction!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    # OTP-аутентификация по номеру телефона
    requestOtp(phone: String!, purpose: OtpPurpose!): OtpResult!
    registerWithPhone(phone: String!, code: String!): AuthPayload!
    loginWithOtp(phone: String!, code: String!): AuthPayload!
    loginWithPassword(phone: String!, password: String!): AuthPayload!
    setPassword(input: SetPasswordInput!): Boolean!
    resetPasswordWithOtp(input: ResetPasswordInput!): AuthPayload!
    updateAvatar(avatar: String): User!
    requestEmailVerification: OtpResult!
    verifyEmail(code: String!): User!
    createAddress(input: AddressInput!): Address!
    editAddress(id: ID!, input: AddressInput!): Address!
    deleteAddress(id: ID!): Boolean!
    selectAddress(id: ID!): Address!
    placeOrder(input: PlaceOrderInput!): Order!
    addFoodReview(input: AddFoodReviewInput!): FoodReview!
    restaurantLogin(input: LoginRestaurantInput!): AuthPayloadRestaurant!
    acceptOrder(input: AcceptOrderInput!): Order!
    cancelOrder(input: CancelOrderInput!): Order!
    ackOrderReceived(input: AckOrderReceivedInput!): Order!
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
    createFood(input: CreateFoodInput!): Food!
    updateFood(id: ID!, input: UpdateFoodInput!): Food!
    setFoodUnavailableUntil(id: ID!, minutesFromNow: Int!): Food!
    bulkSetFoodAvailability(
      foodIds: [ID!]!
      isAvailable: Boolean!
    ): BulkUpdateResult!
    deleteFood(id: ID!): Boolean!
    ownerLogin(input: LoginOwnerInput!): AuthPayloadOwner!
    createRider(input: CreateRiderInput!): Rider!
    createRestaurant(input: CreateRestaurantInput!): Restaurant!
    assignRider(input: AssignRiderInput!): Order!
    riderLogin(input: LoginRiderInput!): AuthPayloadRider!
    claimOrder(orderId: ID!): Order!
    declineAssignedOrder(input: DeclineAssignedOrderInput!): Order!
    updateOrderStatusRider(input: UpdateOrderStatusRiderInput!): Order!
    confirmOrderReceived(input: ConfirmOrderInput!): Order!
    refreshOrderStatus(id: ID!): Order! # ← ДОБАВЬ
    updateRiderLocation(input: RiderLocationInput!): Rider!
    toggleRider(available: Boolean!): Rider!
    updateRiderProfile(input: UpdateRiderProfileInput!): Rider!
    changeRiderPassword(input: ChangeRiderPasswordInput!): Boolean!
    updateConfiguration(input: ConfigurationInput!): Configuration!
    sendChatMessage(orderId: ID!, text: String!): ChatMessage!
    markChatRead(orderId: ID!): Boolean!
    sendTypingStatus(orderId: ID!, isTyping: Boolean!): Boolean!
    startSupportThread(orderId: ID, subject: String): SupportThread!
    sendSupportMessage(
      threadId: ID!
      text: String
      imageUrl: String
    ): SupportMessage!
    assignSupportThread(threadId: ID!): SupportThread!
    closeSupportThread(threadId: ID!): SupportThread!
    reopenSupportThread(threadId: ID!): SupportThread!
    markSupportRead(threadId: ID!): Boolean!
    createOwner(input: CreateOwnerInput!): Owner!
    updateOwner(id: ID!, input: UpdateOwnerInput!): Owner!
    deactivateOwner(id: ID!): Boolean!
    resetOwnerPassword(id: ID!, newPassword: String!): Boolean!
    toggleUserActive(id: ID!, isActive: Boolean!): ToggleUserResult!
    createZone(input: CreateZoneInput!): Zone!
    updateZone(id: ID!, input: UpdateZoneInput!): Zone!
    deleteZone(id: ID!): Boolean!
    updateUser(input: UpdateUserInput!): User!
    markOrderPreparing(orderId: ID!): Order!
    markOrderReady(orderId: ID!): Order!
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
    addRestaurantReview(input: AddRestaurantReviewInput!): RestaurantReview!
    subscribeWebPush(input: WebPushSubscriptionInput!): Boolean!
    unsubscribeWebPush(endpoint: String!): Boolean!
    sendTestWebPush: Boolean!
    requestEmailChange(newEmail: String!): OtpResult!
    confirmEmailChange(code: String!): User!
    cancelEmailChange: Boolean!
    requestPhoneChange(newPhone: String!): OtpResult!
    confirmPhoneChange(code: String!): User!
    cancelPhoneChange: Boolean!
    toggleFavoriteRestaurant(restaurantId: ID!): Restaurant!
    toggleFavoriteFood(foodId: ID!): Food!
    topUpBalance(amount: Float!): Float!
  }

  type Subscription {
    orderStatusChanged(userId: ID!): Order!
    subscriptionOrder(orderId: ID!): Order!
    subscribePlaceOrder(restaurantId: ID!): Order!
    subscriptionAssignedRider(riderId: ID!): Order!
    subscriptionZoneOrders(zoneId: ID): Order!
    subscriptionAvailableOrders(zoneId: ID): Order!
    subscriptionRiderLocation(riderId: ID!): RiderLocationUpdate!
    subscriptionRiderOrderCompleted(riderId: ID!): Order!
    newChatMessage(orderId: ID!): ChatMessage!
    newSupportMessage(threadId: ID!): SupportMessage!
    supportInboxUpdated: SupportThread!
    chatTypingStatus(orderId: ID!): TypingStatusEvent!
    chatReadStatusChanged(orderId: ID!): ChatReadStatusEvent!
    courierSearchNotify: CourierSearchEvent!
    deliveryStatusChanged(orderId: ID!): DeliveryEvent!
    allDeliveries: Order!
    riderNearDropOff(orderId: ID!): RiderNearDropOffEvent!
    riderLocationStream(riderId: ID!): RiderLocation!
    allOrdersChanged: Order!
    subscriptionMenuAvailability(restaurantId: ID!): MenuAvailabilityEvent!
  }
`;
