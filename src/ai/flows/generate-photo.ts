
'use server';

/**
 * @fileOverview Generates a realistic photo from a text prompt, optionally using reference images.
 *
 * - generatePhoto - A function that handles the photo generation process.
 * - GeneratePhotoInput - The input type for the generatePhoto function.
 * - GeneratePhotoOutput - The return type for the generatePhoto function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePhotoInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the photo to generate.'),
  referencePhotoDataUris: z
    .array(z.string())
    .optional()
    .describe(
      "Optional reference photos as data URIs. Each must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GeneratePhotoInput = z.infer<typeof GeneratePhotoInputSchema>;

const GeneratePhotoOutputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "The generated photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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
  async (input) => {
    const promptParts: ({ text: string } | { media: { url: string } })[] = [];

    if (input.referencePhotoDataUris && input.referencePhotoDataUris.length > 0) {
      input.referencePhotoDataUris.forEach(uri => {
        if (uri && typeof uri === 'string' && uri.startsWith('data:image')) {
          promptParts.push({ media: { url: uri } });
        } else {
          console.warn('Invalid or missing data URI for reference photo:', uri);
        }
      });
    }
    promptParts.push({ text: input.prompt });

    // Ensure there's at least one part (the text prompt)
    if (promptParts.length === 0 || (promptParts.length === 1 && !promptParts.find(p => 'text' in p))) {
        // This case should ideally not happen if prompt is always required
        throw new Error("A text prompt is required for image generation.");
    }
    
    // If only text prompt is available after filtering, use it directly as string,
    // otherwise use the array of parts. Gemini API might be sensitive to this.
    const finalPrompt = promptParts.length === 1 && 'text' in promptParts[0] ? promptParts[0].text : promptParts;


    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: finalPrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], 
      },
    });
    
    if (!media?.url) {
      throw new Error('Image generation failed to return a media URL.');
    }

    return {photoDataUri: media.url};
  }
);
