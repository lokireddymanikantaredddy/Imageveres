# Imageveres

Imageveres is an AI-powered photo generation and feedback web app built with Next.js and Firebase. Users can generate images from prompts, upload reference images, and submit feedback on generated results.

## Features
- Generate AI images from text prompts
- Upload and preview reference images
- View generation history
- Submit feedback with ratings and comments
- Feedback images and data stored in Firebase Storage and Firestore
- Admin feedback dashboard

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- Firebase project with Firestore and Storage enabled
- Service account key (set `GOOGLE_APPLICATION_CREDENTIALS` env variable)

### Install Dependencies
```
npm install
```

### Environment Variables
Set the following in your environment (e.g., `.env.local`):
```
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
```

### Run Locally
```
npm run dev
```

### Deploy
- Deploy with Vercel, Firebase Hosting, or your preferred platform.

## Feedback System
- Feedback is submitted via the app and stored in Firestore.
- Images in feedback are uploaded to Firebase Storage.
- View all feedback at `/feedback`.

## Tech Stack
- Next.js
- React
- Firebase (Firestore, Storage, Admin SDK)
- TypeScript
- Zod, React Hook Form

---
For more details, see the code in `src/app/page.tsx` and `src/app/feedback/page.tsx`.
