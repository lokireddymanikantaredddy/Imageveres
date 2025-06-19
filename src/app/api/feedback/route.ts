import { NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebase-admin';
import { Firestore } from 'firebase-admin/firestore';

interface FeedbackData {
  id: string;
  name: string;
  rating?: number;
  feedbackText: string;
  imageUrl: string;
  timestamp: FirebaseFirestore.Timestamp;
}

export async function GET() {
  try {
    if (!firestoreAdmin) {
      throw new Error('Firestore Admin is not initialized');
    }

    const snapshot = await (firestoreAdmin as Firestore)
      .collection('imageFeedback')
      .orderBy('timestamp', 'desc')
      .get();

    const feedback: FeedbackData[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<FeedbackData, 'id'>),
    }));

    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
} 