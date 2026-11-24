import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';
import { ErrorLink } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { errorHandler } from '@fluxu-labs/lib';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';
import { ENV } from 'src/env';
import { eventEmitter } from './eventEmitter';
import { getHeadersFromToken, getLocalStorageToken } from './auth';

// ----------------------------------------------------------------------

type HeadersFn = () => Promise<{ [key: string]: string }>;

// ----------------------------------------------------------------------

const errorLink = () => {
  return new ErrorLink((error) => {
    eventEmitter.emit('apolloError', { error });
    errorHandler({ error });
  });
};

const wsLink = ({ url, headers }: { url: string; headers: HeadersFn }) => {
  return new GraphQLWsLink(
    createClient({
      url: url,
      keepAlive: 5000,
      shouldRetry: () => true,
      retryAttempts: Infinity,
      connectionParams: async () => ({ headers: await headers() }),
    }),
  );
};

const httpLink = ({ url, headers }: { url: string; headers: HeadersFn }) => {
  return new HttpLink({
    uri: url,
    fetch: async (uri, options) => {
      if (options) {
        // headers do context da operacao vencem os default: durante o boot
        // o token no storage ainda pode ser o expirado que esta sendo trocado
        options.headers = {
          ...(await headers()),
          ...options.headers,
        };
      }
      return fetch(uri, options);
    },
  });
};

// ----------------------------------------------------------------------

const getApolloClient = ({
  wsUrl,
  httpUrl,
  headers,
}: {
  wsUrl: string;
  httpUrl: string;
  headers: HeadersFn;
}) => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    queryDeduplication: false,
    defaultOptions: {
      watchQuery: { fetchPolicy: 'no-cache', errorPolicy: 'none' },
      query: { fetchPolicy: 'no-cache', errorPolicy: 'none' },
      mutate: { errorPolicy: 'none' },
    },
    link: errorLink().concat(
      ApolloLink.split(
        ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
        wsLink({ url: wsUrl, headers }),
        httpLink({ url: httpUrl, headers }),
      ),
    ),
  });
};

// ----------------------------------------------------------------------

const apolloClient = getApolloClient({
  wsUrl: ENV.HASURA_WSS,
  httpUrl: ENV.HASURA_HTTPS,
  headers: async () => {
    const token = getLocalStorageToken();
    if (!token) return {};
    return getHeadersFromToken(token);
  },
});

// ----------------------------------------------------------------------

const anonymousApolloClient = getApolloClient({
  wsUrl: ENV.HASURA_WSS,
  httpUrl: ENV.HASURA_HTTPS,
  headers: async () => ({}),
});

export { apolloClient, anonymousApolloClient };
