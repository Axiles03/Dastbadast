import { gql } from "@apollo/client";

export const RIDER_LOGIN = gql`
  mutation RiderLogin($input: LoginRiderInput!) {
    riderLogin(input: $input) {
      token
      rider {
        id
        username
        name
        phone
        email
        photo
      }
    }
  }
`;

// ⭐ НОВОЕ: свежие данные профиля (используется на экране редактирования и
// для повторной синхронизации после смены имени/фото/email).
export const ME_RIDER = gql`
  query MeRider {
    meRider {
      id
      username
      name
      phone
      email
      photo
      available
    }
  }
`;

export const UPDATE_RIDER_PROFILE = gql`
  mutation UpdateRiderProfile($input: UpdateRiderProfileInput!) {
    updateRiderProfile(input: $input) {
      id
      username
      name
      phone
      email
      photo
    }
  }
`;

export const CHANGE_RIDER_PASSWORD = gql`
  mutation ChangeRiderPassword($input: ChangeRiderPasswordInput!) {
    changeRiderPassword(input: $input)
  }
`;
export const COURIER_SEARCH_NOTIFY = gql`
  subscription CourierSearchNotify {
    courierSearchNotify {
      orderId
      orderIdStr
      restaurantName
      restaurantLocation
      riderIds
      radiusKm
      escalation
      fastAcceptBonus
      createdAt
    }
  }
`;

export const AVAILABLE_ORDERS = gql`
  query AvailableOrders {
    availableOrdersForRiders {
      id
      orderId
      orderStatus
      createdAt
      note
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
        foodId
        title
        quantity
      }
      amounts {
        deliveryFee
      }
      statusTimestamps {
        pendingAt
        acceptedAt
        courierSearchTimestamps {
          initialPushedAt
          escalationPushedAt
        }
      }
    }
  }
`;

export const MY_ORDERS = gql`
  query MyOrders($status: OrderStatus) {
    riderOrders(status: $status) {
      id
      orderId
      orderStatus
      createdAt
      note
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
        foodId
        title
        quantity
      }
      amounts {
        deliveryFee
      }
    }
  }
`;

export const CLAIM_ORDER = gql`
  mutation ClaimOrder($orderId: ID!) {
    claimOrder(orderId: $orderId) {
      id
      orderId
      orderStatus
    }
  }
`;

export const UPDATE_STATUS = gql`
  mutation UpdateStatus($input: UpdateOrderStatusRiderInput!) {
    updateOrderStatusRider(input: $input) {
      id
      orderStatus
    }
  }
`;

export const UPDATE_LOCATION = gql`
  mutation UpdateLocation($input: RiderLocationInput!) {
    updateRiderLocation(input: $input) {
      id
      location
      available
    }
  }
`;

export const TOGGLE = gql`
  mutation Toggle($available: Boolean!) {
    toggleRider(available: $available) {
      id
      available
    }
  }
`;

export const SUB_ASSIGNED = gql`
  subscription SubAssigned($riderId: ID!) {
    subscriptionAssignedRider(riderId: $riderId) {
      id
      orderId
      orderStatus
      deliveryAddress {
        address
      }
    }
  }
`;

export const SUB_AVAILABLE = gql`
  subscription SubAvailable($zoneId: ID) {
    subscriptionAvailableOrders(zoneId: $zoneId) {
      id
      orderId
      orderStatus
    }
  }
`;

export const CHAT_MESSAGES = gql`
  query ChatMessages($orderId: ID!) {
    chatMessages(orderId: $orderId) {
      id
      orderId
      senderType
      text
      createdAt
    }
  }
`;

export const SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($orderId: ID!, $text: String!) {
    sendChatMessage(orderId: $orderId, text: $text) {
      id
      senderType
      text
      createdAt
    }
  }
`;

export const SUB_CHAT = gql`
  subscription SubChat($orderId: ID!) {
    newChatMessage(orderId: $orderId) {
      id
      senderType
      text
      createdAt
    }
  }
`;

export const SUB_RIDER_ORDER_COMPLETED = gql`
  subscription SubRiderOrderCompleted($riderId: ID!) {
    subscriptionRiderOrderCompleted(riderId: $riderId) {
      id
      orderId
      orderStatus
    }
  }
`;

export const MY_HISTORY = gql`
  query MyHistory {
    riderOrders(status: DELIVERED) {
      id
      orderId
      orderStatus
      createdAt
      statusTimestamps {
        deliveredAt
      }
      items {
        foodId
        title
        quantity
        price
      }
      amounts {
        total
        deliveryFee
        subtotal
      }
    }
  }
`;

export const MY_TODAY_EARNINGS = gql`
  query MyTodayEarnings {
    riderOrders(status: DELIVERED) {
      id
      amounts {
        deliveryFee
      }
      statusTimestamps {
        deliveredAt
      }
    }
  }
`;

export const SUB_RIDER_LOCATION = gql`
  subscription SubRiderLocation($riderId: ID!) {
    subscriptionRiderLocation(riderId: $riderId) {
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
