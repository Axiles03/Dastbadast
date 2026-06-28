import { gql } from "@apollo/client";

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        name
        email
        phone
      }
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      token
      user {
        id
        name
        email
        phone
      }
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      name
      email
      phone
    }
  }
`;

export const GET_PROFILE = gql`
  query Profile {
    profile {
      id
      name
      email
      phone
    }
  }
`;

export const GET_ADDRESSES = gql`
  query Addresses {
    addresses {
      id
      label
      address
      city
      details
      isSelected
      location
    }
    selectedAddress {
      id
      label
      address
      location
    }
  }
`;

export const GET_DELIVERY_ZONE = gql`
  query GetDeliveryZone {
    deliveryZone {
      id
      name
      description
      polygon
    }
  }
`;

export const CREATE_ADDRESS = gql`
  mutation CreateAddress($input: AddressInput!) {
    createAddress(input: $input) {
      id
      label
      address
      city
      isSelected
      location
    }
  }
`;

export const SELECT_ADDRESS = gql`
  mutation SelectAddress($id: ID!) {
    selectAddress(id: $id) {
      id
      isSelected
    }
  }
`;

export const DELETE_ADDRESS = gql`
  mutation DeleteAddress($id: ID!) {
    deleteAddress(id: $id)
  }
`;

export const GET_RESTAURANTS = gql`
  query GetRestaurants {
    restaurants {
      id
      name
      slug
      image
      address
      minimumOrder
    }
  }
`;

export const GET_RESTAURANT = gql`
  query GetRestaurant($id: ID!) {
    restaurant(id: $id) {
      id
      name
      address
      minimumOrder
      tax
      isAvailable
      categories {
        id
        title
        foods {
          id
          title
          description
          price
          image
          averageRating
          reviewCount
          reviews {
            id
            userName
            rating
            comment
            createdAt
          }
        }
      }
    }
  }
`;

export const GET_RESTAURANT_CHECK = gql`
  query GetRestaurantCheck($id: ID!) {
    restaurant(id: $id) {
      id
      name
      tax
      minimumOrder
      isAvailable
    }
  }
`;

export const GET_CONFIGURATION = gql`
  query GetConfiguration {
    configuration {
      currency
      currencySymbol
      deliveryRate
    }
  }
`;

export const GET_FOOD_REVIEWS = gql`
  query GetFoodReviews($foodId: ID!) {
    foodReviews(foodId: $foodId) {
      id
      userName
      rating
      comment
      createdAt
    }
  }
`;

export const ADD_FOOD_REVIEW = gql`
  mutation AddFoodReview($input: AddFoodReviewInput!) {
    addFoodReview(input: $input) {
      id
      rating
      comment
    }
  }
`;

export const PLACE_ORDER = gql`
  mutation PlaceOrder($input: PlaceOrderInput!) {
    placeOrder(input: $input) {
      id
      orderId
      orderStatus
      amounts {
        subtotal
        tax
        deliveryFee
        total
      }
      items {
        foodId
        title
        price
        quantity
      }
      deliveryAddress {
        address
        city
      }
    }
  }
`;

export const GET_ORDER = gql`
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      orderId
      orderStatus
      paymentMethod
      paid
      paidAt
      paymentStatus
      riderId
      restaurantId
      items {
        foodId
        title
        price
        quantity
      }
      amounts {
        subtotal
        tax
        deliveryFee
        total
      }
      deliveryAddress {
        address
        city
        location
      }
      statusTimestamps {
        deliveredAt
        pickedAt
        assignedAt
        acceptedAt
        pendingAt
      }
      createdAt
    }
  }
`;

export const GET_ORDERS = gql`
  query GetOrders {
    orders {
      id
      orderId
      orderStatus
      paid
      paidAt
      riderId
      amounts {
        total
      }
      deliveryAddress {
        address
        city
      }
      createdAt
    }
  }
`;

export const SUB_USER_ORDERS = gql`
  subscription SubUserOrders($userId: ID!) {
    orderStatusChanged(userId: $userId) {
      id
      orderId
      orderStatus
      riderId
    }
  }
`;

export const SUB_ORDER = gql`
  subscription SubOrder($orderId: ID!) {
    subscriptionOrder(orderId: $orderId) {
      id
      orderId
      orderStatus
    }
  }
`;

export const CONFIRM_ORDER_RECEIVED = gql`
  mutation ConfirmOrderReceived($input: ConfirmOrderInput!) {
    confirmOrderReceived(input: $input) {
      id
      orderId
      orderStatus
      paid
      paidAt
      statusTimestamps {
        deliveredAt
      }
    }
  }
`;

export const GET_CHAT_MESSAGES = gql`
  query GetChatMessages($orderId: ID!) {
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
      orderId
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
      orderId
      senderType
      text
      createdAt
    }
  }
`;

export const SUB_RIDER_LOCATION = gql`
  subscription SubRiderLocation($riderId: ID!) {
    subscriptionRiderLocation(riderId: $riderId) {
      riderId
      lat
      lng
      updatedAt
    }
  }
`;

export const RIDER_LOCATION_QUERY = gql`
  query RiderLocation($id: ID!) {
    rider(id: $id) {
      id
      location {
        coordinates
      }
      lastLocationAt
    }
  }
`;

export const REFRESH_ORDER_STATUS = gql`
  mutation RefreshOrderStatus($id: ID!) {
    refreshOrderStatus(id: $id) {
      id
      orderId
      orderStatus
      paid
      paidAt
      statusTimestamps {
        deliveredAt
      }
    }
  }
`;
