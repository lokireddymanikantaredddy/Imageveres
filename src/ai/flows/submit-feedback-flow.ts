
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
import { firestoreAdmin } from '@/lib/firebase-admin'; // Import the initialized Firestore admin instance

const SubmitFeedbackInputSchema = z.object({
  name: z.string().optional().describe('The name of the user providing feedback (optional).'),
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

    try {
      const feedbackData = {
        name: input.name || 'Anonymous',
        feedbackText: input.feedbackText,
        imageUrl: input.imageUrl,
        timestamp: new Date(input.timestamp), // Convert ISO string to Firestore Timestamp compatible Date object
        // You could add more fields here, e.g., user ID if you implement authentication
      };

      await firestoreAdmin.collection('imageFeedback').add(feedbackData);
      
      console.log('Feedback successfully saved to Firestore document with ID:', feedbackData); // Log on success
      return { success: true, message: 'Feedback submitted successfully and saved!' };

    } catch (error) {
      console.error('Error saving feedback to Firestore:', error);
      let publicErrorMessage = 'Failed to submit feedback due to a server error. Please try again later.';
      
      // Check for common Firebase/GCP errors
      if (error instanceof Error) {
        if (error.message.includes('Missing or insufficient permissions') || 
            (error.hasOwnProperty('code') && (error as any).code === 7)) { // Firestore permission denied code
          publicErrorMessage = 'Server permission error: Unable to save feedback. Please contact support.';
        } else if (error.message.includes('The project is unavailable')) {
           publicErrorMessage = 'The feedback service is temporarily unavailable. Please try again later.';
        }
      }
      return { success: false, message: publicErrorMessage };
    }
  }
);
