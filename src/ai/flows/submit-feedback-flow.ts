'use server';
/**
 * @fileOverview Handles submission of user feedback for generated images and saves it to Firestore.
 *
 * - submitFeedback - A function that handles the feedback submission process.
 * - SubmitFeedbackInput - The input type for the submitFeedback function.
 * - SubmitFeedbackOutput - The return type for the submitFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { firestoreAdmin, storageAdmin } from '@/lib/firebase-admin'; // Import the initialized Firestore and Storage admin instances

const STORAGE_BUCKET_NAME = 'photogenius-6b87d.firebasestorage.app';

const SubmitFeedbackInputSchema = z.object({
  name: z.string().optional().describe('The name of the user providing feedback (optional).'),
  rating: z.number().min(0).max(5).optional().describe('The star rating given by the user (0-5, where 0 means no rating).'),
  feedbackText: z.string().min(1, 'Feedback text cannot be empty.').describe('The user\'s feedback text.'),
  imageUrl: z.string().url('Must be a valid URL.').describe('The URL of the image being reviewed.'),
  timestamp: z.string().datetime('Must be a valid ISO 8601 datetime string.').describe('The timestamp of when the feedback was submitted.'),
});
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

const SubmitFeedbackOutputSchema = z.object({
  success: z.boolean().describe('Whether the feedback submission was successful.'),
  message: z.string().describe('A message detailing the outcome of the submission.'),
});
export type SubmitFeedbackOutput = z.infer<typeof SubmitFeedbackOutputSchema>;

export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackOutput> {
  return submitFeedbackFlow(input);
}

const submitFeedbackFlow = ai.defineFlow(
  {
    name: 'submitFeedbackFlow',
    inputSchema: SubmitFeedbackInputSchema,
    outputSchema: SubmitFeedbackOutputSchema,
  },
  async (input) => {
    console.log('Feedback received for Firestore:', input);

    if (!firestoreAdmin) {
      console.error(
        'Firestore Admin SDK is not initialized. ' +
        'This usually means GOOGLE_APPLICATION_CREDENTIALS is not set or the SDK failed to initialize. ' +
        'Feedback cannot be saved to Firestore.'
      );
      return { 
        success: false, 
        message: 'Server configuration error: Unable to connect to the feedback database. Please contact support if this issue persists.' 
      };
    }

    let imageUrl = input.imageUrl;
    // If imageUrl is a data URI, upload to Firebase Storage
    if (imageUrl.startsWith('data:image/')) {
      if (!storageAdmin) {
        return { success: false, message: 'Server error: Storage is not configured.' };
      }
      try {
        // Extract base64 data
        const matches = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (!matches) {
          return { success: false, message: 'Invalid image data format.' };
        }
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `feedback-images/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.png`;
        const bucket = storageAdmin.bucket(STORAGE_BUCKET_NAME);
        const file = bucket.file(fileName);
        await file.save(buffer, {
          metadata: { contentType: mimeType },
          public: true,
        });
        // Get public URL
        imageUrl = `https://storage.googleapis.com/${STORAGE_BUCKET_NAME}/${fileName}`;
      } catch (err) {
        console.error('Error uploading image to Firebase Storage:', err);
        return { success: false, message: 'Failed to upload image for feedback.' };
      }
    }

    try {
      const feedbackData: any = {
        name: input.name || 'Anonymous',
        feedbackText: input.feedbackText,
        imageUrl: imageUrl,
        timestamp: new Date(input.timestamp), 
      };
      if (input.rating !== undefined && input.rating !== null && input.rating > 0) {
        feedbackData.rating = input.rating;
      }
      const docRef = await firestoreAdmin.collection('imageFeedback').add(feedbackData);
      console.log('Feedback successfully saved to Firestore document with ID:', docRef.id); 
      return { success: true, message: 'Feedback submitted successfully and saved!' };
    } catch (error) {
      console.error('Error saving feedback to Firestore:', error);
      let publicErrorMessage = 'Failed to submit feedback due to a server error. Please try again later.';
      if (error instanceof Error) {
        if (error.message.includes('Missing or insufficient permissions') || 
            (error.hasOwnProperty('code') && (error as any).code === 7)) { 
          publicErrorMessage = 'Server permission error: Unable to save feedback. Please contact support.';
        } else if (error.message.includes('The project is unavailable')) {
           publicErrorMessage = 'The feedback service is temporarily unavailable. Please try again later.';
        }
      }
      return { success: false, message: publicErrorMessage };
    }
  }
);

