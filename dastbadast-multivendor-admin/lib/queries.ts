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
        total
        tax
      }
      items {
        title
        quantity
      }
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

export const GET_CONFIGURATION = gql`
  query GetConfiguration {
    configuration {
      currency
      currencySymbol
      taxPercent
      deliveryRate
      skipEmailVerification
      skipMobileVerification
      testOtp
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
      testOtp
    }
  }
`;

export const ADMIN_ACCOUNTING = gql`
  query AdminAccounting {
    adminAccounting {
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
