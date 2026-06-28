'use client';
import { ApolloClient, ApolloProvider, InMemoryCache, HttpLink, ApolloLink, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { ReactNode, useMemo } from 'react';
import { storage } from './security';

export function ApolloProviderClient({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const httpUri = process.env.NEXT_PUBLIC_SERVER_URL
      ? `${process.env.NEXT_PUBLIC_SERVER_URL}/graphql`
      : 'http://localhost:8001/graphql';
    const wsUri = process.env.NEXT_PUBLIC_WS_SERVER_URL
      ? `${process.env.NEXT_PUBLIC_WS_SERVER_URL}/graphql`
      : 'ws://localhost:8001/graphql';

    const authLink = new ApolloLink((operation, forward) => {
      operation.setContext(({ headers = {} }: any) => {
        const token = storage.get('dbd_admin_token');
        return {
          headers: {
            ...headers,
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            'x-client-type': 'admin',
          },
        };
      });
      return forward(operation);
    });

    const httpLink = authLink.concat(new HttpLink({ uri: httpUri }));

    const wsLink = new GraphQLWsLink(
      createClient({
        url: wsUri,
        connectionParams: () => {
          const token = storage.get('dbd_admin_token');
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      })
    );

    const splitLink = split(
      ({ query }) => {
        const def = getMainDefinition(query);
        return def.kind === 'OperationDefinition' && def.operation === 'subscription';
      },
      wsLink,
      httpLink
    );

    return new ApolloClient({ link: splitLink, cache: new InMemoryCache() });
  }, []);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
