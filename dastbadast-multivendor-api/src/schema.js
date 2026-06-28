export const typeDefs = /* GraphQL */ `
  scalar JSON
  scalar DateTime

  type Configuration {
    currency: String
    currencySymbol: String
    deliveryRate: Float
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
    available: Boolean!
    location: JSON
    lastLocationAt: String
    zoneId: ID
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
    categories: [Category!]
  }
  type Category {
    id: ID!
    title: String!
    image: String
    foods: [Food!]
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
  }
  type FoodReview {
    id: ID!
    foodId: ID!
    userName: String
    rating: Int!
    comment: String!
    createdAt: String!
  }
  input AddFoodReviewInput {
    foodId: ID!
    rating: Int!
    comment: String!
  }

  enum OrderStatus {
    PENDING
    ACCEPTED
    ASSIGNED
    PICKED
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
    price: Float!
    quantity: Int!
    image: String
    description: String
    variation: JSON
    addons: [JSON!]
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
  }

  input OrderItemInput {
    foodId: ID!
    quantity: Int!
    variation: JSON
    addons: [JSON!]
  }
  input PlaceOrderInput {
    restaurantId: ID!
    addressId: ID!
    items: [OrderItemInput!]!
    paymentMethod: PaymentMethod = COD
    note: String
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
  }
  input UpdateFoodInput {
    categoryId: ID
    title: String
    description: String
    image: String
    price: Float
    isAvailable: Boolean
    isActive: Boolean
  }

  input ConfigurationInput {
    currency: String
    currencySymbol: String
    deliveryRate: Float
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

  type Query {
    configuration: Configuration
    deliveryZone: DeliveryZone
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
    adminAccounting: AdminAccounting
    zones: [Zone!]!
    zone(id: ID!): Zone
    adminDashboardMetrics: AdminDashboard!
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
  }
`;
