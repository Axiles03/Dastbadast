import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

export function getClient() {
  const uri = process.env.NEXT_PUBLIC_SERVER_URL
    ? `${process.env.NEXT_PUBLIC_SERVER_URL}/graphql`
    : 'http://localhost:8001/graphql';

  return new ApolloClient({
    link: new HttpLink({
      uri,
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store' }),
    }),
    cache: new InMemoryCache(),
    ssrMode: true,
    defaultOptions: {
      query: { fetchPolicy: 'no-cache' },
    },
  });
}
