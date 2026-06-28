import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  ApolloLink,
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { onError } from "@apollo/client/link/error";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { initApiConfig, type ApiConfig } from "./config/api";

function getToken(): string | undefined {
  return (globalThis as any).__DBD_CLIENT_TOKEN__ as string | undefined;
}

let _client: ApolloClient | null = null;
let _clientConfigKey: string | null = null;

function buildClient(config: ApiConfig): ApolloClient {
  const httpUri = config.graphqlHttp;
  const wsUri = config.graphqlWs;

  const authLink = new ApolloLink((op, fwd) => {
    const t = getToken();
    op.setContext(({ headers = {} }: any) => ({
      headers: {
        ...headers,
        ...(t ? { authorization: `Bearer ${t}` } : {}),
        "x-client-type": "client-app",
      },
    }));
    return fwd(op);
  });

  const errorLink = onError((options: any) => {
    const { graphQLErrors, networkError, operation } = options;
    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        if (err.extensions?.code === "UNAUTHENTICATED") {
          (globalThis as any).__DBD_CLIENT_TOKEN__ = null;
          import("expo-router").then(({ router }) => {
            router.replace("/login");
          });
          continue;
        }
        console.warn(
          `[GraphQL ${err.extensions?.code}] ${operation.operationName}:`,
          err.message,
        );
      }
    }
    if (networkError && networkError.message !== "Network request failed") {
      console.debug(
        `[Network] ${operation.operationName}:`,
        networkError.message,
      );
    }
  });

  const httpLink = errorLink.concat(
    authLink.concat(new HttpLink({ uri: httpUri })),
  );

  const wsLink = new GraphQLWsLink(
    createClient({
      url: wsUri,
      lazy: true,
      retryAttempts: 5,
      shouldRetry: () => true,
      keepAlive: 30_000,
      connectionParams: () => {
        const t = getToken();
        return t ? { authorization: `Bearer ${t}` } : {};
      },
    }),
  );

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
        OrderAmounts: { merge: (_e, i) => i },
        Order: {
          fields: {
            statusTimestamps: { merge: (_e, i) => i },
            items: { merge: (_e: any[] = [], i: any[] = []) => i },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network" },
    },
  });
}

function getOrCreateClient(config: ApiConfig): ApolloClient {
  const key = `${config.http}|${config.ws}`;
  if (_client && _clientConfigKey === key) return _client;
  _client = buildClient(config);
  _clientConfigKey = key;
  return _client;
}

export function resetApolloClient() {
  _client = null;
  _clientConfigKey = null;
}

export function getApolloClient(): ApolloClient | null {
  return _client;
}

export function ApolloProviderClient({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ApiConfig | null>(null);

  useEffect(() => {
    initApiConfig().then(setConfig);
  }, []);

  const client = useMemo(
    () => (config ? getOrCreateClient(config) : null),
    [config],
  );

  if (!client) {
    return (
      <View className="flex-1 bg-soft-bg items-center justify-center">
        <ActivityIndicator color="#F26A4A" size="large" />
        <Text className="text-text-muted mt-3 text-sm">
          Подключаюсь к серверу…
        </Text>
      </View>
    );
  }

  return (
    <ApolloProvider client={client} children={undefined}>
      {children}
    </ApolloProvider>
  );
}
