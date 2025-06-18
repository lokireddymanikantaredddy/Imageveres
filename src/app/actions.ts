
'use server';

import { generatePhoto as generatePhotoFlow, type GeneratePhotoInput } from '@/ai/flows/generate-photo';
import { z } from 'zod';

// Define a schema for the result of the photo generation action
const PhotoGenerationResultSchema = z.object({
  success: z.boolean(),
  data: z.string().optional().describe('The generated photo as a data URI if successful.'),
  error: z.string().optional().describe('An error message if photo generation failed.'),
});

// Define the type for the result based on the schema
export type PhotoGenerationResult = z.infer<typeof PhotoGenerationResultSchema>;

// Server action to handle photo generation
export async function handleGeneratePhotoAction(
  values: GeneratePhotoInput // This type now includes optional referencePhotoDataUris (array)
): Promise<PhotoGenerationResult> {
  try {
    // Input validation is handled by the Genkit flow's inputSchema.
    
    const result = await generatePhotoFlow(values);

    if (result.photoDataUri && typeof result.photoDataUri === 'string' && result.photoDataUri.startsWith('data:image')) {
      return { success: true, data: result.photoDataUri };
    } else {
      console.error('Photo generation flow did not return a valid data URI:', result);
      return { success: false, error: 'Failed to generate photo: Invalid data returned from AI.' };
    }
  } catch (error) {
    console.error('Error in handleGeneratePhotoAction:', error);
    let errorMessage = 'An unknown error occurred during photo generation.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    // Potentially sanitize or provide a more generic error message to the client
    return { success: false, error: `Photo generation failed: ${errorMessage}` };
  }
}
