import { readFileSync } from "fs";
const config = JSON.parse(
  readFileSync(
    "C:/Users/My PC/.config/configstore/firebase-tools.json",
    "utf8",
  ),
);
const corsConfig = JSON.parse(readFileSync("../cors.json", "utf8"));

const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id:
      "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
    grant_type: "refresh_token",
    refresh_token: config.tokens.refresh_token,
  }),
});
const { access_token } = await tokenResp.json();
console.log("Token refreshed OK");

// List Firebase Storage buckets via Firebase Storage Management API
const listResp = await fetch(
  "https://firebasestorage.googleapis.com/v1beta/projects/mms-open-climbs/buckets",
  { headers: { Authorization: "Bearer " + access_token } },
);
const listBody = await listResp.json();
console.log("List status:", listResp.status);
console.log(JSON.stringify(listBody, null, 2));
