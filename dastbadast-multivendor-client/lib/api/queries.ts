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

export const GET_PROFILE_FULL = gql`
  query ProfileFull {
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

export const UPDATE_NAME = gql`
  mutation UpdateName($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      name
      nameChangesLeft
      nameChangeUnlocksAt
    }
  }
`;

export const UPDATE_AVATAR = gql`
  mutation UpdateAvatar($avatar: String) {
    updateAvatar(avatar: $avatar) {
      id
      avatar
      avatarUnlocksAt
    }
  }
`;

export const SET_PASSWORD = gql`
  mutation SetPassword($input: SetPasswordInput!) {
    setPassword(input: $input)
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

export const REGISTER_PUSH_TOKEN = gql`
  mutation RegisterPushToken($input: PushTokenInput!) {
    registerPushToken(input: $input) {
      id
      token
      platform
    }
  }
`;

export const UNREGISTER_PUSH_TOKEN = gql`
  mutation UnregisterPushToken($token: String!) {
    unregisterPushToken(token: $token)
  }
`;

export const MY_PUSH_TOKENS = gql`
  query MyPushTokens {
    myPushTokens {
      id
      platform
      lastUsedAt
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
        hasPassword
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
        hasPassword
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
        hasPassword
      }
    }
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
        hasPassword
      }
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

// ⭐ NEW: пометить чат прочитанным — используется, когда клиент открывает
// секцию чата на экране заказа (см. orders/[id].tsx).
export const MARK_CHAT_READ = gql`
  mutation MarkChatRead($orderId: ID!) {
    markChatRead(orderId: $orderId)
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
