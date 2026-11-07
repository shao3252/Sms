# SMS TAMU Firebase setup notes

The rebuild branch is `sms-tamu-firebase-rebuild`. It is separate from `main`; the live website has not been replaced.

## Firebase project
The client code points to project `smsv2-b09e8`. Firebase Authentication must have Email/Password enabled. Firestore must exist.

## Important: keep Firestore locked until an administrator account is prepared
The file `firestore.rules` is a proposed ruleset. Review it before publishing. Do not use permissive test rules.

## Bootstrap the first administrator
1. Deploy the reviewed `firestore.rules` in Firebase Console → Firestore Database → Rules.
2. Register your own account on the preview site once it is deployed to a preview URL.
3. In Firebase Console → Firestore Data, create collection `admins`.
4. Add a document whose document ID is your Firebase Authentication user UID. The document may contain `createdAt` (timestamp) and `role: "admin"`.
5. Never let the public website create or edit documents in `admins`. The rules intentionally deny all client writes to that collection.

## Implemented in this rebuild branch
- Email/password registration and login.
- Profile bio, username and compressed profile picture.
- Approved-post feed, categories, likes, comments, saved posts and member profiles.
- Member follow/unfollow and personal blocking.
- Admin post approval, payment-detail editing, announcement publishing, report/appeal review and account restriction/restoration.
- Global chat with replies, pinned-message display, admin group lock and compressed group picture.
- VIP payment-reference requests and VIP posts.

## Limitations and checks before production
- This branch has not yet been deployed to a preview or tested against the live Firebase project. Do not merge it into `main` yet.
- The proposed Firestore rules still require validation in Firebase Rules/Emulator before publishing. The rules are deliberately not deployed by this repository.
- Image data is compressed and stored in Firestore documents (no Storage billing required); this is only suitable for small profile/group pictures and is not a scalable image-storage design.
- Admin promotion/removal, verification-badge management, automatic mobile-money verification and full appeal workflow are not complete.
- Firestore may request composite indexes for feed, comments, VIP posts, and chat queries. Create only the indexes Firebase reports.
- Payment references are requests for manual verification. The app does not automatically verify mobile-money transactions.
- Do not enter payment-card details or upgrade Firebase Storage just to make this version run.
