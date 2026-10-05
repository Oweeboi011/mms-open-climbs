"use strict";

// firebase-admin 14 loads jwks-rsa, which requires the ESM-only `jose`.
// Node 22 (the Functions runtime) loads that fine; Jest's CommonJS runtime
// can't. Unit tests never verify ID tokens, so a stub is enough.
module.exports = function jwksClient() {
  return { getSigningKey: () => Promise.reject(new Error("jwks-rsa is stubbed in tests")) };
};
