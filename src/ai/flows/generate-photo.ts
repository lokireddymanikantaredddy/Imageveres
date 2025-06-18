'use server';

/**
 * @fileOverview Generates a realistic photo from a text prompt.
 *
 * - generatePhoto - A function that handles the photo generation process.
 * - GeneratePhotoInput - The input type for the generatePhoto function.
 * - GeneratePhotoOutput - The return type for the generatePhoto function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePhotoInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the photo to generate.'),
});
export type GeneratePhotoInput = z.infer<typeof GeneratePhotoInputSchema>;

const GeneratePhotoOutputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'The generated photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'      
    ),
});
export type GeneratePhotoOutput = z.infer<typeof GeneratePhotoOutputSchema>;

export async function generatePhoto(input: GeneratePhotoInput): Promise<GeneratePhotoOutput> {
  return generatePhotoFlow(input);
}

const generatePhotoFlow = ai.defineFlow(
  {
    name: 'generatePhotoFlow',
    inputSchema: GeneratePhotoInputSchema,
    outputSchema: GeneratePhotoOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images. You MUST use exactly this model to generate images.
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: input.prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE, IMAGE only won't work
      },
    });

    return {photoDataUri: media.url!};
  }
);
