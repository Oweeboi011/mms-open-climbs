# Cloud Functions API Reference

All functions are deployed to Firebase Cloud Functions v2 in the `asia-east1` region (or the default region configured in `firebase.json`).

## Function Overview

```mermaid
graph TD
    FS["Cloud Firestore"]
    subgraph Triggers
        T1["onRegistrationCreated\nregistrations/{regId} onCreate"]
        T2["onRegistrationUpdated\nregistrations/{regId} onUpdate"]
    end
    subgraph Callables
        C1["createUser\nAdmin only"]
    end
    Brevo["Brevo SMTP API"]
    Admin["Admin UI"]

    FS -->|new doc| T1
    T1 -->|increment count| FS
    T1 -->|confirmation email| Brevo

    FS -->|status change| T2
    T2 -->|decrement count if cancelled| FS
    T2 -->|status update email| Brevo

    Admin -->|httpsCallable| C1
    C1 -->|create account| FS
    C1 -->|welcome email + setup link| Brevo
```

---

## Triggers

### onRegistrationCreated

**Type:** Firestore document trigger  
**Path:** `registrations/{regId}` on create

**What it does:**
1. Increments `registrationCount` on the corresponding `climbs/{climbId}` document.
2. Sends a registration confirmation email to the participant via Brevo.

**Email includes:**
- Climb title, date, location
- Link to the printable waiver at `{APP_URL}/waiver/{regId}`

---

### onRegistrationUpdated

**Type:** Firestore document trigger  
**Path:** `registrations/{regId}` on update

**What it does:**
1. If `status` changed to `cancelled`, decrements `registrationCount` on the climb.
2. If `status` changed to `confirmed`, `cancelled`, or `waitlisted`, sends a status update email to the participant.

---

## Callable Functions

### createUser

**Caller:** Admin users only  
**SDK call:** `httpsCallable(functions, 'createUser')`

```mermaid
sequenceDiagram
    autonumber
    participant AD as Admin UI
    participant CF as createUser Function
    participant FS as Firestore
    participant FA as Firebase Auth
    participant EM as Brevo Email
    participant U as New User

    AD->>CF: call createUser({email, displayName, role})
    CF->>FS: Verify caller is admin via users/{uid}.role
    CF->>FA: createUser(email)
    FA-->>CF: uid
    CF->>FS: Create users/{uid} document
    CF->>FA: generatePasswordResetLink(email)
    FA-->>CF: setupLink
    CF->>EM: Send welcome email with setupLink
    EM-->>U: Welcome email
    CF-->>AD: { uid }
```

**Request payload:**

| Field       | Type   | Required | Notes                  |
|------------|--------|----------|------------------------|
| email      | string | Yes      | New user's email       |
| displayName| string | Yes      | New user's display name|
| role       | string | No       | Defaults to "member"   |

**What it does:**
1. Verifies the caller is an admin via Firestore role check.
2. Creates a Firebase Auth account for the new user.
3. Creates a Firestore `users/{uid}` document.
4. Generates a password setup link (Firebase `generatePasswordResetLink`).
5. Sends a welcome email with the setup link via Brevo.

**Response:**

```json
{ "uid": "firebase-auth-uid" }
```

**Error codes:**

| Code             | Meaning                              |
|-----------------|--------------------------------------|
| unauthenticated  | Caller is not signed in              |
| permission-denied| Caller is not an admin               |
| invalid-argument | email or displayName missing         |
| already-exists   | Email already has a Firebase account |
| internal         | Unexpected Firebase error            |

---

## Environment Variables

Set these in `functions/.env` for local emulator, or via Firebase secrets for production.

| Variable        | Description                                |
|----------------|--------------------------------------------|
| BREVO_API_KEY  | Brevo API key for sending emails           |
| BREVO_FROM_EMAIL | Sender email address verified in Brevo   |
| APP_URL        | Base URL for generating email links        |

**Production secrets (recommended):**

```
firebase functions:secrets:set BREVO_API_KEY
firebase functions:secrets:set BREVO_FROM_EMAIL
firebase functions:secrets:set APP_URL
```
