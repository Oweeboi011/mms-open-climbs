"use strict";

// Admin SDK set-up shared by every function module. Required first by
// index.js so initializeApp() runs before any getAuth()/getFirestore().
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

// A club-sized app never needs more than a handful of concurrent instances;
// the cap bounds what a runaway trigger loop or a flood of calls can bill.
// No minInstances — idle warm instances are charged around the clock.
setGlobalOptions({ maxInstances: 5, memory: "256MiB" });

const adminAuth = getAuth();
const db = getFirestore("openclimbs");

module.exports = { db, adminAuth };
