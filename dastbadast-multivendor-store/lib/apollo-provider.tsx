import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  split,
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { onError } from "@apollo/client/link/error";
import { ReactNode, useMemo } from "react";
import { GRAPHQL_HTTP, GRAPHQL_WS } from "./config/api";

function getToken() {
  return (globalThis as any).__DBD_TOKEN__ as string | undefined;
}

let _client: ApolloClient | null = null;

export function getApolloClient(): ApolloClient {
  if (_client) return _client;

  const authLink = new ApolloLink((op, fwd) => {
    const t = getToken();
    op.setContext(({ headers = {} }: any) => ({
      headers: { ...headers, ...(t ? { authorization: `Bearer ${t}` } : {}) },
    }));
    return fwd(op);
  });

  const errorLink = onError(
    ({ graphQLErrors, networkError, operation }: any) => {
      if (graphQLErrors) {
        for (const err of graphQLErrors) {
          if (err.extensions?.code === "UNAUTHENTICATED") {
            (globalThis as any).__DBD_TOKEN__ = null;
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
    },
  );

  const httpLink = errorLink.concat(
    authLink.concat(new HttpLink({ uri: GRAPHQL_HTTP })),
  );

  const wsLink = new GraphQLWsLink(
    createClient({
      url: GRAPHQL_WS,
      lazy: true,
      retryAttempts: 3,
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

  _client = new ApolloClient({
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
  });

  return _client;
}

type ApolloProviderClientProps = {
  children: ReactNode;
};

export function ApolloProviderClient({ children }: ApolloProviderClientProps) {
  const client = useMemo(() => getApolloClient(), []);
  return <ApolloProvider client={client} children={undefined}>{children}</ApolloProvider>;
}
