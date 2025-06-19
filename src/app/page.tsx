"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useForm as useFeedbackForm } from "react-hook-form"; // Renamed for clarity
import { z } from "zod";
import { Loader2, Sparkles, Download, AlertCircle, UploadCloud, Trash2, Image as ImageIcon, XCircle, MessageSquareQuote, Send, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { handleGeneratePhotoAction, type PhotoGenerationResult, handleFeedbackSubmitAction, type FeedbackSubmissionResult } from "./actions";
import { useToast } from "@/hooks/use-toast";
import type { GeneratePhotoInput } from "@/ai/flows/generate-photo";
import type { SubmitFeedbackInput } from "@/ai/flows/submit-feedback-flow";
import { Separator } from "@/components/ui/separator";
import { StarRatingInput } from "@/components/custom/star-rating"; // Import StarRatingInput

const MAX_HISTORY_ITEMS = 10;
const LOCAL_STORAGE_KEY = "photoGeniusHistory";
const MAX_REFERENCE_IMAGES = 5;
const MAX_FILE_SIZE_MB = 5;

const photoFormSchema = z.object({
  prompt: z.string().min(10, {
    message: "Prompt must be at least 10 characters.",
  }).max(1000, {
    message: "Prompt must not exceed 1000 characters."
  }),
  referenceImages: typeof window !== 'undefined' 
    ? z.array(
        z.instanceof(File).refine(file => file.size <= MAX_FILE_SIZE_MB * 1024 * 1024, `Max file size per image is ${MAX_FILE_SIZE_MB}MB.`)
      )
      .optional()
      .refine(files => !files || files.length <= MAX_REFERENCE_IMAGES, `You can upload a maximum of ${MAX_REFERENCE_IMAGES} reference images.`)
    : z.any().optional(),
});

const feedbackFormSchema = z.object({
  name: z.string().optional(),
  rating: z.number().min(0).max(5).optional().default(0), // 0 means no rating
  feedbackText: z.string().min(5, {
    message: "Feedback must be at least 5 characters.",
  }).max(500, {
    message: "Feedback must not exceed 500 characters."
  }),
});


export default function PhotoGeniusPage() {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [referenceImagePreviews, setReferenceImagePreviews] = React.useState<string[]>([]);
  const [generatedHistory, setGeneratedHistory] = React.useState<string[]>([]);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const photoForm = useForm<z.infer<typeof photoFormSchema>>({
    resolver: zodResolver(photoFormSchema),
    defaultValues: {
      prompt: "",
      referenceImages: [],
    },
  });

  const feedbackForm = useFeedbackForm<z.infer<typeof feedbackFormSchema>>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      name: "",
      rating: 0,
      feedbackText: "",
    },
  });


  React.useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedHistory) {
        setGeneratedHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load history from local storage:", e);
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const currentFiles = photoForm.getValues().referenceImages || [];
      const newFilesArray = Array.from(files);
      const combinedFiles = [...currentFiles, ...newFilesArray].slice(0, MAX_REFERENCE_IMAGES);
      
      photoForm.setValue("referenceImages", combinedFiles, { shouldValidate: true });

      const newPreviews: string[] = [];
      const fileReadPromises = combinedFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      Promise.all(fileReadPromises)
        .then(previews => setReferenceImagePreviews(previews))
        .catch(err => {
          console.error("Error reading files for preview:", err);
          toast({ variant: "destructive", title: "Error", description: "Could not generate previews for some images." });
        });
      
      if (combinedFiles.length === 0 && fileInputRef.current) {
         fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveReferenceImage = (indexToRemove: number) => {
    const currentFiles = photoForm.getValues().referenceImages || [];
    const updatedFiles = currentFiles.filter((_: File, index: number) => index !== indexToRemove);
    photoForm.setValue("referenceImages", updatedFiles, { shouldValidate: true });

    const updatedPreviews = referenceImagePreviews.filter((_, index) => index !== indexToRemove);
    setReferenceImagePreviews(updatedPreviews);

    if (updatedFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };

  async function onPhotoSubmit(values: z.infer<typeof photoFormSchema>) {
    setIsLoading(true);
    setImageUrl(null); 
    setError(null);
    feedbackForm.reset(); 

    let referencePhotoDataUris: string[] | undefined = undefined;
    if (values.referenceImages && values.referenceImages.length > 0) {
      try {
        referencePhotoDataUris = await Promise.all(
          values.referenceImages.map((file: File) => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (error) => reject(error);
              reader.readAsDataURL(file);
            });
          })
        );
      } catch (e) {
        setError("Failed to read reference image(s).");
        toast({ variant: "destructive", title: "Error", description: "Could not process the reference image(s)." });
        setIsLoading(false);
        return;
      }
    }

    const actionInput: GeneratePhotoInput = {
      prompt: values.prompt,
      ...(referencePhotoDataUris && referencePhotoDataUris.length > 0 && { referencePhotoDataUris }),
    };

    try {
      const result: PhotoGenerationResult = await handleGeneratePhotoAction(actionInput);
      if (result.success && result.data) {
        setImageUrl(result.data);
        const newHistoryArray = [result.data, ...generatedHistory.filter(item => item !== result.data)].slice(0, MAX_HISTORY_ITEMS);
        setGeneratedHistory(newHistoryArray); 

        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistoryArray));
        } catch (e: any) {
          if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            console.warn("Local storage quota exceeded. Attempting to prune history...");
            toast({
              variant: "default",
              title: "Making Space in History",
              description: "Storage full. Removing oldest images to save the new one.",
              duration: 5000,
            });

            let historyToSaveAttempt = [...newHistoryArray];
            let successfullySaved = false;

            for (let i = 0; i < MAX_HISTORY_ITEMS; i++) {
              if (historyToSaveAttempt.length === 0) break; 

              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(historyToSaveAttempt));
                successfullySaved = true;
                if (historyToSaveAttempt.length < newHistoryArray.length) {
                  setGeneratedHistory(historyToSaveAttempt);
                  toast({
                    title: "History Pruned",
                    description: `Removed ${newHistoryArray.length - historyToSaveAttempt.length} old image(s).`,
                    duration: 3000,
                  });
                }
                break; 
              } catch (pruningError: any) {
                if (pruningError instanceof DOMException && (pruningError.name === 'QuotaExceededError' || pruningError.code === 22 || pruningError.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                  if (historyToSaveAttempt.length > 0) {
                    historyToSaveAttempt.pop(); 
                  } else {
                    break; 
                  }
                } else {
                  console.error("Error during history pruning:", pruningError);
                  toast({
                    variant: "destructive",
                    title: "History Save Error",
                    description: "An unexpected error occurred while trying to prune history.",
                  });
                  break; 
                }
              }
            }

            if (!successfullySaved) {
              console.error("Could not save to local storage even after pruning.", e);
              toast({
                variant: "destructive",
                title: "Storage Full",
                description: "Failed to save to history. New image may be too large or storage is critically full.",
              });
            }
          } else {
            console.error("Failed to save history to local storage (non-quota error):", e);
            toast({
              variant: "destructive",
              title: "History Save Error",
              description: "An unexpected error occurred while saving image history.",
            });
          }
        }
      } else {
        setError(result.error || "An unexpected error occurred.");
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: result.error || "Could not generate the photo. Please try again.",
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Generation Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onFeedbackSubmit(values: z.infer<typeof feedbackFormSchema>) {
    if (!imageUrl) {
      toast({ variant: "destructive", title: "Error", description: "No image selected for feedback." });
      return;
    }
    setIsSubmittingFeedback(true);
    try {
      const feedbackInput: Omit<SubmitFeedbackInput, 'timestamp'> = {
        name: values.name || undefined, 
        rating: values.rating && values.rating > 0 ? values.rating : undefined,
        feedbackText: values.feedbackText,
        imageUrl: imageUrl,
      };
      const result: FeedbackSubmissionResult = await handleFeedbackSubmitAction(feedbackInput);
      if (result.success) {
        toast({ title: "Feedback Submitted", description: result.message });
        feedbackForm.reset();
      } else {
        toast({ variant: "destructive", title: "Feedback Failed", description: result.message });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Feedback Error", description: errorMessage });
    } finally {
      setIsSubmittingFeedback(false);
    }
  }


  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    let extension = 'png';
    try {
      const mimeTypeMatch = imageUrl.match(/^data:(image\/[^;]+);base64,/);
      if (mimeTypeMatch && mimeTypeMatch[1]) {
        const mimeType = mimeTypeMatch[1];
        extension = mimeType.split('/')[1] || 'png';
      }
    } catch (e) {
      console.warn("Could not determine image extension from data URI, defaulting to png.", e)
    }
    link.download = `photogenius-art.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearHistory = () => {
    setGeneratedHistory([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear history from local storage:", e);
    }
    toast({ title: "History Cleared", description: "Your image generation history has been cleared." });
  };

  const handleRemoveHistoryItem = (indexToRemove: number) => {
    const updatedHistory = generatedHistory.filter((_, index) => index !== indexToRemove);
    setGeneratedHistory(updatedHistory);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
      toast({ title: "Image Removed", description: "Image removed from history." });
    } catch (e) {
      console.error("Failed to update history in local storage:", e);
      toast({ variant: "destructive", title: "Error", description: "Could not update history." });
    }
  };

  const [currentYear, setCurrentYear] = React.useState<number | null>(null);
  React.useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8 md:p-12 selection:bg-primary/30 selection:text-primary-foreground">
      <div className="w-full max-w-2xl">
        <Card className="shadow-2xl rounded-xl overflow-hidden">
          <CardHeader className="bg-card-foreground/5 p-6 sm:p-8">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-3xl sm:text-4xl font-headline text-center text-primary">
                  Imageveres
                </CardTitle>
                <CardDescription className="text-center text-muted-foreground text-sm sm:text-base pt-2">
                  Transform your ideas into stunning visuals. Describe what you want to see, and let AI bring it to life.
                </CardDescription>
              </div>
              {/* <Button variant="outline" asChild>
                <a href="/" className="flex items-center gap-2">
                  <MessageSquareQuote className="w-4 h-4" />
                  View Feedback
                </a>
              </Button> */}
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6 sm:space-y-8">
            <Form {...photoForm}>
              <form onSubmit={photoForm.handleSubmit(onPhotoSubmit)} className="space-y-6">
                <FormField
                  control={photoForm.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="prompt-input" className="text-lg font-medium text-foreground">
                        Enter your prompt
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="prompt-input"
                          placeholder="e.g., A majestic lion wearing a crown, photorealistic masterpiece, 4k"
                          className="resize-none text-base border-input focus:border-primary focus:ring-primary"
                          {...field}
                          rows={3}
                          disabled={isLoading}
                          aria-describedby="prompt-form-message"
                        />
                      </FormControl>
                      <FormMessage id="prompt-form-message" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={photoForm.control}
                  name="referenceImages"
                  render={({ fieldState }) => (
                    <FormItem>
                      <FormLabel htmlFor="reference-images-input" className="text-lg font-medium text-foreground">
                        Optional: Add Reference Images (up to {MAX_REFERENCE_IMAGES})
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="reference-images-input"
                          type="file"
                          accept="image/*"
                          multiple 
                          onChange={handleFileChange}
                          disabled={isLoading || (referenceImagePreviews.length >= MAX_REFERENCE_IMAGES)}
                          className="text-base border-input focus:border-primary focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          aria-describedby="reference-images-form-message"
                          ref={fileInputRef}
                        />
                      </FormControl>
                      <FormMessage id="reference-images-form-message">{fieldState.error?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                {referenceImagePreviews.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Reference image(s) preview:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {referenceImagePreviews.map((previewSrc, index) => (
                        <div key={index} className="relative group aspect-square">
                          <Image
                            src={previewSrc}
                            alt={`Reference image preview ${index + 1}`}
                            layout="fill"
                            objectFit="cover"
                            className="rounded-md border border-border"
                            data-ai-hint="reference preview"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 bg-black/50 text-white hover:bg-black/70 hover:text-white opacity-70 group-hover:opacity-100 transition-opacity z-10"
                            onClick={() => handleRemoveReferenceImage(index)}
                            aria-label={`Remove reference image ${index + 1}`}
                            disabled={isLoading}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || isSubmittingFeedback}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-3 rounded-md transition-all duration-150 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-2"
                  aria-label="Generate photo based on prompt"
                  aria-live="polite"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Photo
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {error && !isLoading && (
              <Alert variant="destructive" className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Generation Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {imageUrl && !isLoading && (
              <div className="mt-8 sm:mt-10 space-y-4 animate-in fade-in duration-500">
                <h2 className="text-2xl sm:text-3xl font-headline text-center text-primary">
                  Your Masterpiece
                </h2>
                <div className="aspect-square w-full overflow-hidden rounded-lg border-2 border-primary/30 shadow-lg bg-muted/30">
                  <Image
                    src={imageUrl}
                    alt={photoForm.getValues().prompt || "Generated photo"}
                    width={1024}
                    height={1024}
                    className="h-full w-full object-contain"
                    priority
                    data-ai-hint="generated image"
                  />
                </div>
                <Button
                  onClick={handleDownload}
                  className="w-full text-base py-3 rounded-md border-primary/50 text-primary hover:bg-primary/10 hover:text-primary focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-2"
                  variant="outline"
                  aria-label="Download generated photo"
                  disabled={isLoading || isSubmittingFeedback}
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download Photo
                </Button>

                <Separator className="my-6 sm:my-8" />

                <div className="space-y-4">
                   <h3 className="text-xl sm:text-2xl font-headline text-center text-primary/90">
                    Share Your Feedback
                  </h3>
                  <Form {...feedbackForm}>
                    <form onSubmit={feedbackForm.handleSubmit(onFeedbackSubmit)} className="space-y-4">
                      <FormField
                        control={feedbackForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="feedback-name">Your Name (Optional)</FormLabel>
                            <FormControl>
                              <Input id="feedback-name" placeholder="Anonymous" {...field} disabled={isSubmittingFeedback || isLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={feedbackForm.control}
                        name="rating"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="feedback-rating">Rate this image (Optional)</FormLabel>
                            <FormControl>
                              <StarRatingInput
                                value={field.value || 0}
                                onChange={field.onChange}
                                disabled={isSubmittingFeedback || isLoading}
                                size={28}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={feedbackForm.control}
                        name="feedbackText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="feedback-text">How was this creation?</FormLabel>
                            <FormControl>
                              <Textarea
                                id="feedback-text"
                                placeholder="e.g., Loved the colors, but could be sharper!"
                                className="resize-none"
                                {...field}
                                rows={3}
                                disabled={isSubmittingFeedback || isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        disabled={isSubmittingFeedback || isLoading || !imageUrl}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {isSubmittingFeedback ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-5 w-5" />
                            Submit Feedback
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </div>
              </div>
            )}
             {isLoading && (
                <div className="mt-8 sm:mt-10 space-y-4 text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">Generating your image, please wait...</p>
                </div>
            )}
          </CardContent>
          {generatedHistory.length > 0 && (
            <>
              <Separator />
              <CardFooter className="p-6 sm:p-8 flex-col items-start space-y-4">
                <div className="w-full flex justify-between items-center">
                  <h3 className="text-xl font-headline text-primary">Generation History</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearHistory}
                    disabled={isLoading || isSubmittingFeedback}
                    aria-label="Clear image generation history"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear History
                  </Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 w-full">
                  {generatedHistory.map((histImgSrc, index) => (
                    <div key={index} className="relative group aspect-square">
                      <Image
                        src={histImgSrc}
                        alt={`History image ${index + 1}`}
                        width={100}
                        height={100}
                        className="h-full w-full object-cover rounded-md border-2 border-transparent group-hover:border-primary transition-all cursor-pointer"
                        onClick={() => { 
                          if (!isLoading && !isSubmittingFeedback) {
                            setImageUrl(histImgSrc); 
                            feedbackForm.reset(); 
                          }
                        }}
                        data-ai-hint="history thumbnail"
                      />
                       <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-5 w-5 bg-black/50 text-white hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 p-0.5"
                          onClick={(e) => {
                            e.stopPropagation(); 
                            if (!isLoading && !isSubmittingFeedback) handleRemoveHistoryItem(index);
                          }}
                          aria-label={`Remove history image ${index + 1}`}
                          disabled={isLoading || isSubmittingFeedback}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                  ))}
                </div>
              </CardFooter>
            </>
          )}
        </Card>
        <footer className="mt-8 sm:mt-12 text-center text-sm text-muted-foreground">
          {currentYear !== null ? <p>&copy; {currentYear} Imageveres. All rights reserved.</p> : <div className="h-4 w-48 bg-muted-foreground/20 mx-auto rounded animate-pulse"></div>}
        </footer>
      </div>
    </main>
  );
}
