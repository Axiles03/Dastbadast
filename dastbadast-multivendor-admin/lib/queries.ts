// dastbadast-multivendor-admin/lib/queries.ts
import { gql } from "@apollo/client";

export const OWNER_LOGIN = gql`
  mutation OwnerLogin($input: LoginOwnerInput!) {
    ownerLogin(input: $input) {
      token
      owner {
        id
        email
        userType
      }
    }
  }
`;

export const GET_RESTAURANTS = gql`
  query GetRestaurants {
    restaurants {
      id
      name
      address
      isAvailable
      minimumOrder
      tax
      location
      zoneId
    }
  }
`;

export const GET_RESTAURANT_DETAIL = gql`
  query GetRestaurantDetail($id: ID!) {
    restaurant(id: $id) {
      id
      name
      slug
      address
      minimumOrder
      tax
      isAvailable
      location
      workingHours {
        open
        close
        isAlwaysOpen
      }
      isOpenNow
    }
  }
`;

export const UPDATE_RESTAURANT = gql`
  mutation UpdateRestaurant($id: ID!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id
      name
      address
      minimumOrder
      tax
      isAvailable
    }
  }
`;

export const CREATE_RIDER = gql`
  mutation CreateRider($input: CreateRiderInput!) {
    createRider(input: $input) {
      id
      username
      name
      available
    }
  }
`;

export const GET_RIDERS = gql`
  query GetRiders($available: Boolean) {
    riders(available: $available) {
      id
      username
      name
      available
      phone
      email
      photo
      isActive
      zoneId
      averageRating
      totalRatings
      totalDeliveries
    }
  }
`;

export const GET_RIDER_DETAIL = gql`
  query GetRiderDetail($id: ID!) {
    rider(id: $id) {
      id
      username
      name
      phone
      email
      photo
      available
      isActive
      zoneId
      averageRating
      totalRatings
      totalDeliveries
      balance
      createdAt
    }
  }
`;

export const GET_RIDER_FINANCIALS = gql`
  query GetRiderFinancials($riderId: ID!) {
    riderFinancials(riderId: $riderId) {
      riderId
      riderName
      balance
      totalEarned
      totalDeliveries
      averageDeliveryFee
    }
  }
`;

export const UPDATE_RIDER = gql`
  mutation UpdateRider($id: ID!, $input: UpdateRiderInput!) {
    updateRider(id: $id, input: $input) {
      id
      username
      name
      phone
      email
      photo
      isActive
      zoneId
    }
  }
`;

export const TOGGLE_RIDER_ACTIVE = gql`
  mutation ToggleRiderActive($id: ID!, $isActive: Boolean!) {
    toggleRiderActive(id: $id, isActive: $isActive) {
      id
      isActive
    }
  }
`;

export const GET_MONITOR_ORDERS = gql`
  query MonitorOrders {
    allOrders(status: null) {
      id
      orderId
      orderStatus
      createdAt
      updatedAt
      note
      riderId
      deliveryAddress {
        address
        city
      }
      pickupAddress {
        name
        address
        location
      }
      amounts {
        subtotal
        tax
        deliveryFee
        total
      }
      items {
        title
        quantity
        price
      }
      statusTimestamps {
        cancelledAt
        acceptedAt
        assignedAt
        pickedAt
        deliveredAt
      }
      cancelReason
    }
  }
`;

export const CREATE_RESTAURANT = gql`
  mutation CreateRestaurant($input: CreateRestaurantInput!) {
    createRestaurant(input: $input) {
      id
      name
      slug
      address
      isAvailable
    }
  }
`;

export const ASSIGN_RIDER = gql`
  mutation AssignRider($input: AssignRiderInput!) {
    assignRider(input: $input) {
      id
      orderStatus
      riderId
    }
  }
`;

export const SUB_ZONE_ORDERS = gql`
  subscription SubZone($zoneId: ID) {
    subscriptionZoneOrders(zoneId: $zoneId) {
      id
      orderId
      orderStatus
    }
  }
`;

export const ALL_DELIVERIES_SUB = gql`
  subscription AllOrdersChanged {
    allOrdersChanged {
      _id
      orderId
      orderStatus
    }
  }
`;

export const GET_CONFIGURATION = gql`
  query GetConfiguration {
    configuration {
      currency
      currencySymbol
      taxPercent
      deliveryRate
      deliveryBaseKm
      deliveryBasePrice
      deliveryPerKmPrice
      skipEmailVerification
      skipMobileVerification
      testOtp
      waitCompensationFreeMinutes
      waitCompensationPerMinute
    }
  }
`;

export const UPDATE_CONFIGURATION = gql`
  mutation UpdateConfiguration($input: ConfigurationInput!) {
    updateConfiguration(input: $input) {
      currency
      currencySymbol
      taxPercent
      deliveryRate
      deliveryBaseKm
      deliveryBasePrice
      deliveryPerKmPrice
      testOtp
      waitCompensationFreeMinutes
      waitCompensationPerMinute
    }
  }
`;

// ⭐ ИЗМЕНЕНО: добавлены опциональные переменные $from, $to
export const ADMIN_ACCOUNTING = gql`
  query AdminAccounting($from: String, $to: String) {
    adminAccounting(from: $from, to: $to) {
      totalRevenue
      totalDelivered
      totalCommission
      restaurants {
        restaurantId
        restaurantName
        orderCount
        revenue
        commission
        payout
      }
      riders {
        riderId
        riderName
        phone
        deliveredCount
        totalEarnings
      }
    }
  }
`;

// === Owner management (только SUPER_ADMIN) ===
export const OWNERS = gql`
  query Owners {
    owners {
      id
      email
      name
      avatarUrl
      userType
      isActive
      lastLoginAt
      createdAt
      permissions {
        canManageRestaurants
        canManageRiders
        canManageZones
        canManageConfiguration
        canViewAccounting
        canAssignRiders
        canManageUsers
      }
    }
  }
`;

export const CREATE_OWNER = gql`
  mutation CreateOwner($input: CreateOwnerInput!) {
    createOwner(input: $input) {
      id
      email
      name
      avatarUrl
      userType
      isActive
    }
  }
`;

export const UPDATE_OWNER = gql`
  mutation UpdateOwner($id: ID!, $input: UpdateOwnerInput!) {
    updateOwner(id: $id, input: $input) {
      id
      email
      name
      avatarUrl
      userType
      isActive
    }
  }
`;

export const DEACTIVATE_OWNER = gql`
  mutation DeactivateOwner($id: ID!) {
    deactivateOwner(id: $id)
  }
`;

export const RESET_OWNER_PASSWORD = gql`
  mutation ResetOwnerPassword($id: ID!, $newPassword: String!) {
    resetOwnerPassword(id: $id, newPassword: $newPassword)
  }
`;

// === Admin: Users ===
export const ADMIN_USERS = gql`
  query AdminUsers($filter: AdminUsersFilter) {
    adminUsers(filter: $filter) {
      total
      users {
        id
        name
        email
        phone
        isActive
        createdAt
        addressesCount
        totalOrders
        totalSpent
        lastOrderAt
      }
    }
  }
`;

export const ADMIN_USER_DETAIL = gql`
  query AdminUserDetail($id: ID!) {
    adminUserDetail(id: $id) {
      user {
        id
        name
        email
        phone
        isActive
        createdAt
      }
      addresses {
        id
        label
        address
        city
        details
        isSelected
      }
      orders {
        id
        orderId
        orderStatus
        total
        restaurantName
        createdAt
      }
    }
  }
`;

export const USER_LTV = gql`
  query UserLTV($userId: ID!) {
    userLTV(userId: $userId) {
      userId
      orderCount
      totalSpent
      avgOrderValue
      cancelledCount
      firstOrderAt
      lastOrderAt
      activeDays
      predictedAnnualLTV
      isPredictionReliable
    }
  }
`;

// ⭐ NEW: Частота заказов клиента
export const USER_ORDER_FREQUENCY = gql`
  query UserOrderFrequency($userId: ID!) {
    userOrderFrequency(userId: $userId) {
      userId
      totalOrders
      deliveredOrders
      cancelledOrders
      avgIntervalDays
      medianIntervalDays
      ordersPerWeek
      ordersPerMonth
      longestGapDays
      status
      daysSinceLastOrder
      cohortMonth
    }
  }
`;

// ⭐ NEW: Когортный анализ retention (по всем пользователям)
export const USER_COHORTS = gql`
  query UserCohorts($months: Int) {
    userCohorts(months: $months) {
      months
      cohorts {
        month
        totalUsers
        retentionByMonth
      }
    }
  }
`;

// ⭐ NEW: Churn rate
export const CHURN_RATE = gql`
  query ChurnRate($period: Int) {
    churnRate(period: $period) {
      period
      activeAtStart
      churned
      retained
      churnRatePct
      retentionRatePct
      avgOrdersPerRetained
    }
  }
`;

// ⭐ NEW: Прогноз спроса
export const DEMAND_FORECAST = gql`
  query DemandForecast($days: Int) {
    demandForecast(days: $days) {
      history {
        date
        revenue
        orders
      }
      forecast {
        date
        predictedRevenue
        predictedOrders
        isForecast
      }
      totals {
        avgDailyRevenue
        avgDailyOrders
        totalForecastRevenue
        trendPct
      }
    }
  }
`;

export const TOGGLE_USER_ACTIVE = gql`
  mutation ToggleUserActive($id: ID!, $isActive: Boolean!) {
    toggleUserActive(id: $id, isActive: $isActive) {
      id
      isActive
    }
  }
`;

export const ZONES = gql`
  query Zones {
    zones {
      id
      name
      description
      isActive
      polygon
      surgeMultiplier
    }
  }
`;

export const ZONE_ONE = gql`
  query Zone($id: ID!) {
    zone(id: $id) {
      id
      name
      description
      isActive
      polygon
    }
  }
`;

export const CREATE_ZONE = gql`
  mutation CreateZone($input: CreateZoneInput!) {
    createZone(input: $input) {
      id
      name
      description
      isActive
      surgeMultiplier
    }
  }
`;

export const UPDATE_ZONE = gql`
  mutation UpdateZone($id: ID!, $input: UpdateZoneInput!) {
    updateZone(id: $id, input: $input) {
      id
      name
      description
      isActive
      surgeMultiplier
    }
  }
`;

export const DELETE_ZONE = gql`
  mutation DeleteZone($id: ID!) {
    deleteZone(id: $id)
  }
`;

export const ADMIN_DASHBOARD = gql`
  query AdminDashboard {
    adminDashboardMetrics {
      today {
        orders
        delivered
        cancelled
        revenue
      }
      live {
        activeOrders
        activeRiders
        restaurantsOnline
      }
      newUsersToday
      chart7Days {
        date
        count
        revenue
      }
      topRestaurants {
        restaurantId
        name
        orderCount
        revenue
      }
      topRiders {
        riderId
        name
        deliveredCount
        earnings
      }
    }
  }
`;

export const ALL_RIDERS_WITH_LOCATION = gql`
  query AllRidersWithLocation {
    allRidersWithLocation {
      id
      username
      name
      phone
      email
      photo
      available
      isActive
      lastLocationAt
      location
      zoneId
      totalDeliveries
      averageRating
      totalRatings
    }
  }
`;

export const ORDERS_FOR_MAP = gql`
  query OrdersForMap($status: OrderStatus) {
    ordersForMap(status: $status) {
      id
      orderId
      orderStatus
      createdAt
      riderId
      pickupAddress {
        name
        address
        city
        location
      }
      deliveryAddress {
        address
        city
        location
      }
      items {
        title
        price
        quantity
      }
      amounts {
        total
        deliveryFee
      }
      statusTimestamps {
        pendingAt
        acceptedAt
        assignedAt
        pickedAt
        deliveredAt
      }
    }
  }
`;

export const RIDER_LOCATION_STREAM = gql`
  subscription RiderLocationStream($riderId: ID!) {
    riderLocationStream(riderId: $riderId) {
      riderId
      lat
      lng
      bearing
      speedKmh
      updatedAt
      stopped
    }
  }
`;

// ⭐ NEW: чат поддержки

export const GET_SUPPORT_THREADS = gql`
  query GetSupportThreads(
    $status: String
    $assignedToMe: Boolean
    $showAll: Boolean
    $search: String
  ) {
    supportThreads(
      status: $status
      assignedToMe: $assignedToMe
      showAll: $showAll
      search: $search
    ) {
      id
      participantType
      participantId
      participantName
      participantAvatar
      orderId
      subject
      status
      assignedOwnerId
      assignedOwnerEmail
      assignedOwnerEmail
      assignedOwnerName
      assignedOwnerAvatar
      closedByName
      lastMessageAt
      lastMessagePreview
      lastSenderType
      participantReadAt
      unreadForStaff
      createdAt
    }
  }
`;

export const GET_SUPPORT_MESSAGES = gql`
  query GetSupportMessages($threadId: ID!) {
    supportMessages(threadId: $threadId) {
      id
      threadId
      senderType
      senderName
      text
      imageUrl
      senderAvatar
      readByParticipant
      createdAt
    }
  }
`;

export const SEND_SUPPORT_MESSAGE = gql`
  mutation SendSupportMessage(
    $threadId: ID!
    $text: String
    $imageUrl: String
  ) {
    sendSupportMessage(threadId: $threadId, text: $text, imageUrl: $imageUrl) {
      id
      threadId
      senderType
      senderName
      text
      imageUrl
      senderAvatar
      createdAt
    }
  }
`;

export const ASSIGN_SUPPORT_THREAD = gql`
  mutation AssignSupportThread($threadId: ID!) {
    assignSupportThread(threadId: $threadId) {
      id
      assignedOwnerId
      assignedOwnerEmail
    }
  }
`;

export const CLOSE_SUPPORT_THREAD = gql`
  mutation CloseSupportThread($threadId: ID!) {
    closeSupportThread(threadId: $threadId) {
      id
      status
    }
  }
`;

export const REOPEN_SUPPORT_THREAD = gql`
  mutation ReopenSupportThread($threadId: ID!) {
    reopenSupportThread(threadId: $threadId) {
      id
      status
    }
  }
`;

export const MARK_SUPPORT_READ = gql`
  mutation MarkSupportRead($threadId: ID!) {
    markSupportRead(threadId: $threadId)
  }
`;

export const SUB_NEW_SUPPORT_MESSAGE = gql`
  subscription SubNewSupportMessage($threadId: ID!) {
    newSupportMessage(threadId: $threadId) {
      id
      threadId
      senderType
      senderName
      text
      imageUrl
      readByParticipant
      createdAt
    }
  }
`;

export const SUB_SUPPORT_INBOX = gql`
  subscription SubSupportInbox {
    supportInboxUpdated {
      id
      status
      lastMessageAt
      lastMessagePreview
      lastSenderType
      assignedOwnerId
      unreadForStaff
    }
  }
`;
