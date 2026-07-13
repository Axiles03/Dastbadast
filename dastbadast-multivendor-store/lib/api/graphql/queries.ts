import { gql } from "@apollo/client";

export const RESTAURANT_LOGIN = gql`
  mutation RestaurantLogin($input: LoginRestaurantInput!) {
    restaurantLogin(input: $input) {
      token
      restaurant {
        id
        name
      }
    }
  }
`;

export const RESTAURANT_ORDERS = gql`
  query RestaurantOrders($status: OrderStatus) {
    restaurantOrders(status: $status) {
      id
      orderId
      orderStatus
      paymentMethod
      paid
      createdAt
      note
      riderId
      items {
        foodId
        title
        price
        quantity
      }
      amounts {
        subtotal
      }
      deliveryAddress {
        address
        city
      }
      pickupAddress {
        name
        address
      }
      statusTimestamps {
        pendingAt
        acceptedAt
        assignedAt
        pickedAt
        deliveredAt
        cancelledAt
        prepTime
        courierSearchTimestamps {
          initialPushedAt
          escalationPushedAt
        }
      }
    }
  }
`;

export const ACCEPT_ORDER = gql`
  mutation AcceptOrder($input: AcceptOrderInput!) {
    acceptOrder(input: $input) {
      id
      orderStatus
    }
  }
`;

export const CANCEL_ORDER = gql`
  mutation CancelOrder($input: CancelOrderInput!) {
    cancelOrder(input: $input) {
      id
      orderStatus
      cancelReason
    }
  }
`;

export const SUB_PLACE_ORDER = gql`
  subscription SubPlaceOrder($restaurantId: ID!) {
    subscribePlaceOrder(restaurantId: $restaurantId) {
      id
      orderId
      orderStatus
      items {
        foodId
        title
        price
        quantity
      }
      amounts {
        subtotal
      }
      deliveryAddress {
        address
      }
    }
  }
`;

export const MARK_ORDER_READY = gql`
  mutation MarkOrderReady($orderId: ID!) {
    markOrderReady(orderId: $orderId) {
      id
      orderStatus
    }
  }
`;

// ⭐ NEW: загрузка кухни — для модалки выбора времени приготовления
// (раньше модалка показывала статичный список 20..60 без учёта очереди).
export const KITCHEN_LOAD = gql`
  query KitchenLoad {
    kitchenLoad {
      queueLength
      avgActualPrepMin
      suggestedPrepTime
      isBusy
    }
  }
`;

export const MY_MENU = gql`
  query MyMenu {
    meRestaurant {
      id
      name
      minimumOrder
      isAvailable
      isOpenNow
      workingHours {
        open
        close
        isAlwaysOpen
      }
      categories {
        id
        title
        image
        foods {
          id
          title
          description
          price
          image
          isAvailable
          isActive
          isVegetarian
          isVegan
          spiceLevel
          allergens
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
      }
    }
  }
`;

export const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      title
    }
  }
`;

export const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
      title
    }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const CREATE_FOOD = gql`
  mutation CreateFood($input: CreateFoodInput!) {
    createFood(input: $input) {
      id
      title
      price
      isAvailable
      isVegetarian
      spiceLevel
      allergens
      optionGroups {
        id
        title
        options {
          id
          title
          price
        }
      }
    }
  }
`;

export const UPDATE_FOOD = gql`
  mutation UpdateFood($id: ID!, $input: UpdateFoodInput!) {
    updateFood(id: $id, input: $input) {
      id
      title
      price
      isAvailable
      isVegetarian
      spiceLevel
      allergens
      optionGroups {
        id
        title
        options {
          id
          title
          price
        }
      }
    }
  }
`;

export const UPDATE_MY_RESTAURANT = gql`
  mutation UpdateMyRestaurant($input: UpdateMyRestaurantInput!) {
    updateMyRestaurant(input: $input) {
      id
      minimumOrder
      isAvailable
      workingHours {
        open
        close
        isAlwaysOpen
      }
    }
  }
`;

export const DELETE_FOOD = gql`
  mutation DeleteFood($id: ID!) {
    deleteFood(id: $id)
  }
`;
