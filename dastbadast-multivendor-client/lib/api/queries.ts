import { gql } from "@apollo/client";

import { ORDER_LIST_ITEM_FRAGMENT, ORDER_TRACKING_FRAGMENT } from "./fragments";

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
      city
      location
    }
  }
`;

export const GET_DELIVERY_ZONE = gql`
  query GetDeliveryZone {
    deliveryZone {
      id
      name
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

export const GET_RESTAURANT_CHECK = gql`
  query GetRestaurantCheck($id: ID!) {
    restaurant(id: $id) {
      id
      name
      tax
      minimumOrder
      isAvailable
      # ⭐ ШАГ 4: координаты ресторана — нужны для расчёта цены доставки (fromCoords).
      # Без этого cart показывает "0 сом" (useQuery skip → deliveryFee = 0).
      location
    }
  }
`;

export const FOOD_WITH_OPTIONS_FRAGMENT = gql`
  fragment FoodWithOptions on Food {
    id
    title
    description
    price
    image
    isAvailable
    optionGroups {
      id
      title
      required
      multiple
      minSelect
      maxSelect
      sortOrder
      options {
        id
        title
        price
        isAvailable
      }
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
        image
        foods {
          ...FoodWithOptions
        }
      }
    }
  }
  ${FOOD_WITH_OPTIONS_FRAGMENT}
`;

export const GET_CONFIGURATION = gql`
  query GetConfiguration {
    configuration {
      currency
      currencySymbol
      deliveryRate
      # ⭐ ШАГ 4: динамические параметры цены доставки (по km)
      deliveryBaseKm
      deliveryBasePrice
      deliveryPerKmPrice
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
      ...OrderTrackingFields
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
      # ⭐ ШАГ 4: добавлено для отображения цены доставки в tracking
      deliveryPrice
      deliveryBreakdown {
        base
        perKm
        distanceKm
        total
        isOverBase
      }
      routeDistanceKm
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
  ${ORDER_TRACKING_FRAGMENT}
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
      ...OrderListItem
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
  ${ORDER_LIST_ITEM_FRAGMENT}
`;

export const SUB_USER_ORDERS = gql`
  subscription SubUserOrders($userId: ID!) {
    orderStatusChanged(userId: $userId) {
      id
      orderId
      orderStatus
      riderId
      ...OrderListItem
    }
  }
  ${ORDER_LIST_ITEM_FRAGMENT}
`;

export const SUB_ORDER = gql`
  subscription SubOrder($orderId: ID!) {
    subscriptionOrder(orderId: $orderId) {
      id
      orderId
      orderStatus
      ...OrderTrackingFields
    }
  }
  ${ORDER_TRACKING_FRAGMENT}
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
      bearing
      speedKmh
      updatedAt
      stopped
    }
  }
`;

export const RIDER_LOCATION_QUERY = gql`
  query RiderLocation($id: ID!) {
    rider(id: $id) {
      id
      location
      lastLocationAt
    }
  }
`;

// ⭐ ШАГ 4: query для расчёта цены доставки по координатам
// (вызывается из cart). Использует API: utils/delivery-price.js → calculateDeliveryPrice()
export const CALCULATE_DELIVERY_PRICE = gql`
  query CalculateDeliveryPrice($fromCoords: JSON!, $toCoords: JSON!) {
    calculateDeliveryPrice(fromCoords: $fromCoords, toCoords: $toCoords)
  }
`;

// ⭐ ШАГ 4: query для полной разбивки цены (для UI-чека: "10 + 6 = 16 сом. (3.2 км)")
export const CALCULATE_DELIVERY_PRICE_BREAKDOWN = gql`
  query CalculateDeliveryPriceBreakdown(
    $fromCoords: JSON!
    $toCoords: JSON!
    $basePrice: Float
    $baseKm: Float
    $perKmPrice: Float
  ) {
    calculateDeliveryPriceBreakdown(
      fromCoords: $fromCoords
      toCoords: $toCoords
      basePrice: $basePrice
      baseKm: $baseKm
      perKmPrice: $perKmPrice
    ) {
      base
      perKm
      distanceKm
      total
      isOverBase
    }
  }
`;
