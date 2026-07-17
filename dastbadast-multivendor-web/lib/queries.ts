// dastbadast-multivendor-web/lib/queries.ts
import { gql } from "@apollo/client";

import {
  ORDER_LIST_ITEM_FRAGMENT,
  ORDER_TRACKING_FRAGMENT,
} from "./graphql/fragments";

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

export const REQUEST_OTP = gql`
  mutation RequestOtp($phone: String!, $purpose: OtpPurpose!) {
    requestOtp(phone: $phone, purpose: $purpose) {
      sent
      ttlSeconds
    }
  }
`;

export const REGISTER_WITH_PHONE = gql`
  mutation RegisterWithPhone($phone: String!, $code: String!) {
    registerWithPhone(phone: $phone, code: $code) {
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

export const LOGIN_WITH_OTP = gql`
  mutation LoginWithOtp($phone: String!, $code: String!) {
    loginWithOtp(phone: $phone, code: $code) {
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

export const LOGIN_WITH_PASSWORD = gql`
  mutation LoginWithPassword($phone: String!, $password: String!) {
    loginWithPassword(phone: $phone, password: $password) {
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

export const SET_PASSWORD = gql`
  mutation SetPassword($input: SetPasswordInput!) {
    setPassword(input: $input)
  }
`;

export const RESET_PASSWORD_WITH_OTP = gql`
  mutation ResetPasswordWithOtp($input: ResetPasswordInput!) {
    resetPasswordWithOtp(input: $input) {
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
      nameChangesLeft
      nameChangeUnlocksAt
    }
  }
`;

export const REQUEST_EMAIL_CHANGE = gql`
  mutation RequestEmailChange($newEmail: String!) {
    requestEmailChange(newEmail: $newEmail) {
      sent
      ttlSeconds
    }
  }
`;

export const CONFIRM_EMAIL_CHANGE = gql`
  mutation ConfirmEmailChange($code: String!) {
    confirmEmailChange(code: $code) {
      id
      email
      emailVerifiedAt
      pendingEmail
    }
  }
`;

export const CANCEL_EMAIL_CHANGE = gql`
  mutation CancelEmailChange {
    cancelEmailChange
  }
`;

export const REQUEST_PHONE_CHANGE = gql`
  mutation RequestPhoneChange($newPhone: String!) {
    requestPhoneChange(newPhone: $newPhone) {
      sent
      ttlSeconds
    }
  }
`;

export const CONFIRM_PHONE_CHANGE = gql`
  mutation ConfirmPhoneChange($code: String!) {
    confirmPhoneChange(code: $code) {
      id
      phone
      pendingPhone
    }
  }
`;

export const CANCEL_PHONE_CHANGE = gql`
  mutation CancelPhoneChange {
    cancelPhoneChange
  }
`;
export const UPDATE_AVATAR = gql`
  mutation UpdateAvatar($avatar: String) {
    updateAvatar(avatar: $avatar) {
      id
      avatar
    }
  }
`;

export const REQUEST_EMAIL_VERIFICATION = gql`
  mutation RequestEmailVerification {
    requestEmailVerification {
      sent
      ttlSeconds
    }
  }
`;

export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($code: String!) {
    verifyEmail(code: $code) {
      id
      email
      emailVerifiedAt
    }
  }
`;

export const GET_PROFILE = gql`
  query Profile {
    profile {
      id
      name
      nameChangesLeft
      nameChangeUnlocksAt
      email
      emailVerifiedAt
      pendingEmail
      phone
      pendingPhone
      hasPassword
      avatar
      avatarUnlocksAt
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
  query GetRestaurants($latitude: Float, $longitude: Float) {
    restaurants(latitude: $latitude, longitude: $longitude) {
      id
      name
      slug
      image
      address
      minimumOrder
      averageRating
      totalRatings
      estimatedPrepMinutes
      # ⭐ НОВОЕ: distance/deliveryTime/price — резолвятся через $geoNear,
      # если latitude/longitude переданы. Без них возвращают null/prep-фолбэк.
      distanceKm
      deliveryTime
      deliveryPriceEstimate
      isFavorite
    }
  }
`;

export const ADD_RESTAURANT_REVIEW = gql`
  mutation AddRestaurantReview($input: AddRestaurantReviewInput!) {
    addRestaurantReview(input: $input) {
      id
      rating
      comment
      userName
    }
  }
`;

// ⭐ ДОБАВЛЕНО: лёгкая проверка ресторана для корзины
export const GET_RESTAURANT_CHECK = gql`
  query GetRestaurantCheck($id: ID!) {
    restaurant(id: $id) {
      id
      name
      tax
      minimumOrder
      isAvailable
      isOpenNow
      workingHours {
        open
        close
        isAlwaysOpen
      }
      location
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
      isOpenNow
      workingHours {
        open
        close
        isAlwaysOpen
      }
      averageRating
      totalRatings
      estimatedPrepMinutes
      isFavorite
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
          isVegetarian
          isVegan
          spiceLevel
          allergens
          isFavorite
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
    restaurantReviews(restaurantId: $id) {
      id
      userName
      rating
      comment
      createdAt
    }
  }
`;

export const RESTAURANT_REVIEWS = gql`
  query RestaurantReviews($restaurantId: ID!, $limit: Int) {
    restaurantReviews(restaurantId: $restaurantId, limit: $limit) {
      id
      userName
      rating
      comment
      createdAt
    }
  }
`;

// ⭐ NEW: Избранное. Мутации возвращают { id, isFavorite } — этого достаточно,
// чтобы Apollo InMemoryCache сам обновил ВСЕ карточки этого ресторана/блюда
// на странице (в списке, на странице ресторана и т.д.) по нормализованному
// ключу "Restaurant:<id>" / "Food:<id>", без ручного update() в каждом месте.
export const TOGGLE_FAVORITE_RESTAURANT = gql`
  mutation ToggleFavoriteRestaurant($restaurantId: ID!) {
    toggleFavoriteRestaurant(restaurantId: $restaurantId) {
      id
      isFavorite
    }
  }
`;

export const TOGGLE_FAVORITE_FOOD = gql`
  mutation ToggleFavoriteFood($foodId: ID!) {
    toggleFavoriteFood(foodId: $foodId) {
      id
      isFavorite
    }
  }
`;

export const GET_MY_FAVORITES = gql`
  query GetMyFavorites {
    myFavoriteRestaurants {
      id
      name
      slug
      image
      address
      minimumOrder
      averageRating
      totalRatings
      estimatedPrepMinutes
      distanceKm
      deliveryTime
      deliveryPriceEstimate
      isFavorite
    }
    myFavoriteFoods {
      id
      title
      description
      price
      image
      averageRating
      reviewCount
      isFavorite
      restaurantId
      restaurantName
    }
  }
`;

export const GET_CONFIGURATION = gql`
  query GetConfiguration {
    configuration {
      currency
      currencySymbol
      deliveryRate
      deliveryBaseKm
      deliveryBasePrice
      deliveryPerKmPrice
    }
  }
`;

// ⭐ ШАГ 4: query для расчёта цены доставки по координатам (вызывается из cart)
// Использует API: utils/delivery-price.js → calculateDeliveryPrice()
export const CALCULATE_DELIVERY_PRICE = gql`
  query CalculateDeliveryPrice($fromCoords: JSON!, $toCoords: JSON!) {
    calculateDeliveryPrice(fromCoords: $fromCoords, toCoords: $toCoords)
  }
`;

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
      # ⭐⭐⭐ ВОТ ОН — КЛЮЧЕВОЙ ФИКС: prepTime
      statusTimestamps {
        deliveredAt
        pickedAt
        assignedAt
        acceptedAt
        pendingAt
        prepTime
        courierSearchTimestamps {
          initialPushedAt
          escalationPushedAt
        }
      }
      # ⭐ ШАГ 3: доставка — динамическая по km (API вычисляет через calculateDeliveryPrice)
      deliveryPrice
      # ⭐ ШАГ 4: полная разбивка цены (база + perKm + расстояние)
      deliveryBreakdown {
        base
        perKm
        distanceKm
        total
        isOverBase
      }
      # ⭐ ШАГ 3: расстояние маршрута (для UI "📏 3.2 км")
      routeDistanceKm
      # ⭐ ШАГ 3: ETA в секундах от курьера до клиента (для SSR/других клиентов;
      # на web используется client-side etaMin из riderPos для real-time)
      etaToCustomer
      # Для будущей миграции на OSRM
      routeGeometry
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
      restaurantId
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
      items {
        foodId
        title
        price
        quantity
        selectedOptions {
          groupId
          optionId
        }
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
      riderId
      # ⭐ ШАГ 3: поля добавлены чтобы refetch сразу получал свежие ETA / price
      deliveryPrice
      routeDistanceKm
      etaToCustomer
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

export const GET_CHAT_MESSAGES = gql`
  query GetChatMessages($orderId: ID!) {
    chatMessages(orderId: $orderId) {
      id
      orderId
      senderType
      text
      imageUrl
      readAt
      createdAt
    }
  }
`;

export const SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($orderId: ID!, $text: String, $imageUrl: String) {
    sendChatMessage(orderId: $orderId, text: $text, imageUrl: $imageUrl) {
      id
      orderId
      senderType
      text
      imageUrl
      readAt
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
      imageUrl
      readAt
      createdAt
    }
  }
`;

// ⭐ NEW: пометить чат прочитанным — вызывается, когда клиент открывает
// панель чата на странице отслеживания заказа.
export const MARK_CHAT_READ = gql`
  mutation MarkChatRead($orderId: ID!) {
    markChatRead(orderId: $orderId)
  }
`;

// ⭐ NEW: индикатор "печатает" (типизация под сторону курьера)
export const SEND_TYPING_STATUS = gql`
  mutation SendTypingStatus($orderId: ID!, $isTyping: Boolean!) {
    sendTypingStatus(orderId: $orderId, isTyping: $isTyping)
  }
`;

export const SUB_CHAT_TYPING = gql`
  subscription SubChatTyping($orderId: ID!) {
    chatTypingStatus(orderId: $orderId) {
      orderId
      senderType
      isTyping
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
      location
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

export const ORDER_FRAGMENT = gql`
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

export const SUB_ORDER_UPDATED = gql`
  subscription SubOrderUpdated($orderId: ID!) {
    subscriptionOrder(orderId: $orderId) {
      ...OrderTrackingFields
    }
  }
  ${ORDER_FRAGMENT}
`;

export const GET_ORDER_FULL = gql`
  query GetOrderFull($id: ID!) {
    order(id: $id) {
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
      pickupAddress {
        name
        address
        location
      }
      createdAt
    }
  }
  ${ORDER_FRAGMENT}
`;

export const ORDER_LIST_ITEM = gql`
  fragment OrderListItem on Order {
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
`;

export const START_SUPPORT_THREAD = gql`
  mutation StartSupportThread($orderId: ID, $subject: String) {
    startSupportThread(orderId: $orderId, subject: $subject) {
      id
      orderId
      subject
      status
      assignedOwnerName
      assignedOwnerAvatar
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
      readByStaff
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

export const SUB_SUPPORT_MESSAGE = gql`
  subscription SubSupportMessage($threadId: ID!) {
    newSupportMessage(threadId: $threadId) {
      id
      threadId
      senderType
      senderName
      text
      imageUrl
      readByStaff
      createdAt
    }
  }
`;

export const MARK_SUPPORT_READ = gql`
  mutation MarkSupportRead($threadId: ID!) {
    markSupportRead(threadId: $threadId)
  }
`;

export const VAPID_PUBLIC_KEY_QUERY = gql`
  query VapidPublicKey {
    vapidPublicKey
  }
`;

export const SUBSCRIBE_WEB_PUSH = gql`
  mutation SubscribeWebPush($input: WebPushSubscriptionInput!) {
    subscribeWebPush(input: $input)
  }
`;

export const UNSUBSCRIBE_WEB_PUSH = gql`
  mutation UnsubscribeWebPush($endpoint: String!) {
    unsubscribeWebPush(endpoint: $endpoint)
  }
`;

export const SEND_TEST_WEB_PUSH = gql`
  mutation SendTestWebPush {
    sendTestWebPush
  }
`;
