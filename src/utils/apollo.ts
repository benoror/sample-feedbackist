import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { onError } from 'apollo-link-error';
import { BatchHttpLink } from 'apollo-link-batch-http';
import { ApolloLink, Observable } from 'apollo-link';

import { getJWT, clearJWT } from './jwt';

const cache = new InMemoryCache();

const request = async (operation: any) => {
  operation.setContext(() => {
    // On every request to the API, retrieve the JWT from local storage.
    const jwt = getJWT();

    // If the JWT exists, include it in the `Authorization` header.
    // If not, don't include the `Authorization` header at all.
    return {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
    };
  });
};

const requestLink = new ApolloLink(
  (operation, forward) =>
    new Observable(observer => {
      let handle: any;
      Promise.resolve(operation)
        .then(oper => request(oper))
        .then(() => {
          if (forward) {
            handle = forward(operation).subscribe({
              next: observer.next.bind(observer),
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer)
            });
          }
        })
        .catch(observer.error.bind(observer));

      return () => {
        if (handle) handle.unsubscribe();
      };
    })
);

const client = new ApolloClient({
  link: ApolloLink.from([
    onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors)
        graphQLErrors.forEach(({ message, locations, path }) =>
          console.log(
            `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
          )
        );
      if (networkError) {
        if ((networkError as any).statusCode === 401) {
          clearJWT();
        }
      }
    }),
    requestLink,
    new BatchHttpLink({
      uri: process.env.REACT_APP_MY_APP_ENDPOINT
    })
  ]),
  cache
});

export default client;
