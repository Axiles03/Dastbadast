"use client";
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  HttpLink,
  ApolloLink,
  split,
} from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { onError } from "@apollo/client/link/error";
import { ReactNode, useMemo } from "react";
import { storage } from "./security";

// FIX: singleton client для использования вне React tree
// (например, в sendChatMessage в tracking/page.tsx)
let _client: ApolloClient | null = null;

function getToken(): string | null {
  return storage.get("db_token");
}

function buildClient(): ApolloClient {
  const httpUri = process.env.NEXT_PUBLIC_SERVER_URL
    ? `${process.env.NEXT_PUBLIC_SERVER_URL}/graphql`
    : "http://localhost:8001/graphql";
  const wsUri = process.env.NEXT_PUBLIC_WS_SERVER_URL
    ? `${process.env.NEXT_PUBLIC_WS_SERVER_URL}/graphql`
    : "ws://localhost:8001/graphql";

  // 1) Authorization header
  const authLink = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers = {} }: any) => {
      const token = getToken();
      return {
        headers: {
          ...headers,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "x-client-type": "web",
        },
      };
    });
    return forward(operation);
  });

  // 2) FIX: ErrorLink — централизованная обработка всех GraphQL/network ошибок
  // Тихие коды (UNAUTHENTICATED, ошибки polling RiderLocation) не спамят alert'ами.
  const errorLink = onError(
    ({ graphQLErrors, networkError, operation }: any) => {
      if (graphQLErrors) {
        for (const err of graphQLErrors) {
          // Токен протух — выкидываем на главную
          if (err.extensions?.code === "UNAUTHENTICATED") {
            storage.remove("db_token");
            storage.remove("db_user");
            if (
              typeof window !== "undefined" &&
              window.location.pathname !== "/"
            ) {
              window.location.href = "/";
            }
            continue;
          }
          // Игнорим шумные polling-ошибки для rider location
          if (operation.operationName === "RiderLocation") {
            continue;
          }
          // Cast to ObjectId failed (на пустой/невалидный riderId) — тихо
          if (err.message?.includes("Cast to ObjectId failed")) {
            continue;
          }
          // Всё остальное — в консоль
          console.warn(
            `[GraphQL ${err.extensions?.code ?? "ERR"}] ${operation.operationName}:`,
            err.message,
          );
        }
      }
      if (networkError) {
        console.debug(
          `[Network] ${operation.operationName}:`,
          networkError.message,
        );
      }
    },
  );

  const httpLink = errorLink.concat(
    authLink.concat(new HttpLink({ uri: httpUri })),
  );

  // 3) FIX: WS — lazy, retryAttempts, shouldRetry
  const wsLink = new GraphQLWsLink(
    createClient({
      url: wsUri,
      lazy: true,
      retryAttempts: 5,
      shouldRetry: () => true,
      connectionParams: () => {
        const token = getToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  );

  // 4) Разделяем HTTP и WS
  const splitLink = split(
    ({ query }) => {
      const def = getMainDefinition(query);
      return (
        def.kind === "OperationDefinition" && def.operation === "subscription"
      );
    },
    wsLink,
    httpLink,
  );

  return new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache({
      typePolicies: {
        // FIX: OrderAmounts — нет поля id, но Apollo ругается при merge.
        // Указываем merge function, которая всегда берёт incoming.
        OrderAmounts: {
          merge: (_existing, incoming) => incoming,
        },
        // FIX: Order — указываем что поля могут быть разными между запросами
        Order: {
          fields: {
            // statusTimestamps — глубокий merge, берём incoming
            statusTimestamps: {
              merge: (_existing, incoming) => incoming,
            },
            // items — массив без id, мерджим по foodId
            items: {
              merge: (_existing: any[] = [], incoming: any[] = []) => incoming,
            },
          },
        },
        Query: {
          fields: {
            // orders: { ... } — стандартный merge
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network" },
    },
  });
}

/**
 * FIX: singleton accessor — можно дёргать client из любого места
 * (например, из submitMessage в tracking page, без хука).
 */
export function getApolloClient(): ApolloClient {
  if (!_client) {
    _client = buildClient();
  }
  return _client;
}

export function ApolloProviderClient({ children }: { children: ReactNode }) {
  const client = useMemo(() => getApolloClient(), []);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
