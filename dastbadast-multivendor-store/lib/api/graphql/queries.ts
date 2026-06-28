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
        tax
        deliveryFee
        total
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
        total
      }
      deliveryAddress {
        address
      }
    }
  }
`;

export const MY_MENU = gql`
  query MyMenu {
    meRestaurant {
      id
      name
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
    }
  }
`;

export const DELETE_FOOD = gql`
  mutation DeleteFood($id: ID!) {
    deleteFood(id: $id)
  }
`;
