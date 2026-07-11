import { gql } from "@apollo/client";

export const ORDER_LIST_ITEM_FRAGMENT = gql`
  fragment OrderListItem on Order {
    id
    orderId
    orderStatus
    paid
    paidAt
    paymentStatus
    riderId
    deliveryPrice
    amounts {
      total
    }
    deliveryAddress {
      address
      city
    }
    createdAt
  }
`;

export const ORDER_TRACKING_FRAGMENT = gql`
  fragment OrderTrackingFields on Order {
    id
    orderId
    orderStatus
    paymentMethod
    paid
    paidAt
    paymentStatus
    riderId
    deliveryPrice
    etaToCustomer
    routeDistanceKm
    deliveryBreakdown {
      base
      perKm
      distanceKm
      total
      isOverBase
    }
    statusTimestamps {
      deliveredAt
      pickedAt
      assignedAt
      acceptedAt
      pendingAt
      prepTime
    }
    riderLocation {
      lat
      lng
      updatedAt
    }
  }
`;
