"use strict";

// Entry point Firebase deploys: re-exports every trigger, schedule and
// callable. The code lives in the modules below (see docs/guides/API.md).
require("./shared/admin");

const { onRegistrationCreated, onRegistrationUpdated, onRegistrationDeleted } = require("./triggers/registrations");
const { onClimbUpdated } = require("./triggers/climbs");
const { sendReminderNotifications } = require("./scheduled/reminders");
const { syncAdminClaim } = require("./triggers/adminClaim");
const { ensureAdminClaim, createUser, updateUserProfile, deleteUserAccount } = require("./callables/users");
const { sendReleaseNoteEmail, getReleaseNoteCommitOptions, generateReleaseNoteDraft } = require("./callables/releaseNotes");
const { getEmailStats, getStorageUsage, getFunctionHealth, getBillingCost } = require("./callables/insights");

exports.onRegistrationCreated = onRegistrationCreated;
exports.onRegistrationUpdated = onRegistrationUpdated;
exports.onRegistrationDeleted = onRegistrationDeleted;
exports.onClimbUpdated = onClimbUpdated;
exports.sendReminderNotifications = sendReminderNotifications;
exports.syncAdminClaim = syncAdminClaim;
exports.ensureAdminClaim = ensureAdminClaim;
exports.createUser = createUser;
exports.updateUserProfile = updateUserProfile;
exports.deleteUserAccount = deleteUserAccount;
exports.sendReleaseNoteEmail = sendReleaseNoteEmail;
exports.getReleaseNoteCommitOptions = getReleaseNoteCommitOptions;
exports.generateReleaseNoteDraft = generateReleaseNoteDraft;
exports.getEmailStats = getEmailStats;
exports.getStorageUsage = getStorageUsage;
exports.getFunctionHealth = getFunctionHealth;
exports.getBillingCost = getBillingCost;

// ── Social preview prerender for /event/** ───────────────────────────────────
// Serves the built app shell with per-climb OG tags injected, so links shared
// to Messenger/Facebook render a real card instead of a bare URL. See the
// hosting rewrite in firebase.json.
exports.ogPrerender = require("./ogPrerender").ogPrerender;
