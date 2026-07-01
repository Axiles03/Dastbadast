import { gql } from "@apollo/client";

export const RIDER_LOGIN = gql`
  mutation RiderLogin($input: LoginRiderInput!) {
    riderLogin(input: $input) {
      token
      rider {
        id
        username
        name
      }
    }
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
      }
      deliveryAddress {
        address
        city
      }
      items {
        foodId
        title
        quantity
      }
      amounts {
        total
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
      }
      deliveryAddress {
        address
        city
      }
      items {
        foodId
        title
        quantity
      }
      amounts {
        total
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
