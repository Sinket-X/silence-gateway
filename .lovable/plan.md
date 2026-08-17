# Security Hardening & Audit Plan

Bhai, Silence API ka security audit aur hardening plan tayyar hai. Hum gateway, admin/user portals, aur database layer par brutality ke saath security inject karenge taaki bina auth ke providers ki details ya models ka abuse namumkin ho jaye.

## Proposed Changes

### 1. Gateway Hardening
- **Strict Model Visibility**: `runGateway` mein model lookup ko update karenge taaki sirf vahi models access ho sakein jo platform par `enabled` hain aur jinka provider bhi `enabled` hai.
- **Failover Leak Protection**: `describeUpstream` aur `sanitizeUpstream` ko aur brutel banayenge taaki upstream errors se kisi bhi tarah ki partial keys, internal URLs, ya provider metadata leak na ho.
- **SSRF Prevention Layer**: `upsertProvider` mein already SSRF check hai, lekin hum `gateway-core.server.ts` mein fetch calls se pehle final hostname verification dalenge.

### 2. Authentication & Session Security
- **Fingerprint Enforcement**: Har protected page mount par `verifySessionFingerprint` check ko aur strict karenge. Agar fingerprint mismatch hota hai, toh instantly logout trigger hoga.
- **Admin/User Separation**: Role-based access control (RBAC) ko server functions mein double-check karenge taaki koi 'user' galti se bhi admin RPCs call na kar sake.
- **Rate Limiting Protection**: Admin login aur user login par IP strike logic ko tighten karenge. 20 strikes/10min par hard IP ban (1 hour) enforce karenge.

### 3. Database & API Security
- **RLS Lockdown**: Database schema mein saari tables par `REVOKE ALL ON ... FROM anon` aur `REVOKE ALL ON ... FROM authenticated` (unless needed) verify karenge.
- **Atomic Accounting**: `gw_debit_api_key` aur `gw_debit_provider_token` functions ko secure banayenge taaki concurrent requests mein balance bypass na ho sake.
- **Encrypted Storage Audit**: `crypto.server.ts` mein AES-256-GCM encryption key management ko audit karenge (key rotation mechanism plan).

### 4. GitHub Protection
- **Secret Scanning Simulation**: Pure codebase ko scan karenge kisi bhi hardcoded token, test key, ya development environment variable ke liye jo galti se push ho gaya ho.
- **Deployment Safety**: Cloudflare environment variables guide ko update karenge `README.md` mein taaki users galti se secrets expose na karein.

## Technical Details
- **Encryption**: AES-256-GCM with PBKDF2 derived keys.
- **Auth**: Supabase Auth + custom HMAC challenges + Device Fingerprinting.
- **Network**: Cloudflare Workers environment with outbound URL filtering.

Bhai, implementation shuru kar raha hun. Ek baar ho jaye toh extreme brutality ke saath attack karke verify karenge! 🚀
