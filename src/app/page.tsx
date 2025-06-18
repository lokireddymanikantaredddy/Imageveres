
"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Sparkles, Download, AlertCircle, UploadCloud, Trash2, Image as ImageIcon, XCircle } from "lucide-react";

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
import { handleGeneratePhotoAction, type PhotoGenerationResult } from "./actions";
import { useToast } from "@/hooks/use-toast";
import type { GeneratePhotoInput } from "@/ai/flows/generate-photo";
import { Separator } from "@/components/ui/separator";

const MAX_HISTORY_ITEMS = 10;
const LOCAL_STORAGE_KEY = "photoGeniusHistory";

const formSchema = z.object({
  prompt: z.string().min(10, {
    message: "Prompt must be at least 10 characters.",
  }).max(1000, {
    message: "Prompt must not exceed 1000 characters."
  }),
  referenceImage: typeof window !== 'undefined' 
    ? z.instanceof(File).optional().refine(file => !file || file.size <= 5 * 1024 * 1024, "Max file size is 5MB.") 
    : z.any().optional(),
});

export default function PhotoGeniusPage() {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = React.useState<string | null>(null);
  const [generatedHistory, setGeneratedHistory] = React.useState<string[]>([]);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      referenceImage: undefined,
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
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("referenceImage", file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue("referenceImage", undefined);
      setReferenceImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveReferenceImage = () => {
    form.setValue("referenceImage", undefined, { shouldValidate: true });
    setReferenceImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset the file input
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setImageUrl(null);
    setError(null);

    let referencePhotoDataUri: string | undefined = undefined;
    if (values.referenceImage) {
      try {
        referencePhotoDataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(values.referenceImage as File);
        });
      } catch (e) {
        setError("Failed to read reference image.");
        toast({ variant: "destructive", title: "Error", description: "Could not process the reference image." });
        setIsLoading(false);
        return;
      }
    }

    const actionInput: GeneratePhotoInput = {
      prompt: values.prompt,
      ...(referencePhotoDataUri && { referencePhotoDataUri }),
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

  const [currentYear, setCurrentYear] = React.useState<number | null>(null);
  React.useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8 md:p-12 selection:bg-primary/30 selection:text-primary-foreground">
      <div className="w-full max-w-2xl">
        <Card className="shadow-2xl rounded-xl overflow-hidden">
          <CardHeader className="bg-card-foreground/5 p-6 sm:p-8">
            <CardTitle className="text-3xl sm:text-4xl font-headline text-center text-primary">
              PhotoGenius
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground text-sm sm:text-base pt-2">
              Transform your ideas into stunning visuals. Describe what you want to see, and let AI bring it to life.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6 sm:space-y-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
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
                  control={form.control}
                  name="referenceImage"
                  render={({ fieldState }) => (
                    <FormItem>
                      <FormLabel htmlFor="reference-image-input" className="text-lg font-medium text-foreground">
                        Optional: Add Reference Image
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="reference-image-input"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={isLoading}
                          className="text-base border-input focus:border-primary focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          aria-describedby="reference-image-form-message"
                          ref={fileInputRef}
                        />
                      </FormControl>
                      <FormMessage id="reference-image-form-message">{fieldState.error?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                {referenceImagePreview && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Reference image preview:</p>
                    <div className="relative group w-28 h-28">
                      <Image
                        src={referenceImagePreview}
                        alt="Reference image preview"
                        width={100}
                        height={100}
                        className="rounded-md border border-border object-cover w-full h-full"
                        data-ai-hint="reference preview"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 bg-black/50 text-white hover:bg-black/70 hover:text-white opacity-70 group-hover:opacity-100 transition-opacity"
                        onClick={handleRemoveReferenceImage}
                        aria-label="Remove reference image"
                        disabled={isLoading}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
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
                    alt={form.getValues().prompt || "Generated photo"}
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
                  disabled={isLoading}
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download Photo
                </Button>
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
                    disabled={isLoading}
                    aria-label="Clear image generation history"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear History
                  </Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 w-full">
                  {generatedHistory.map((histImgSrc, index) => (
                    <button
                      key={index}
                      onClick={() => { !isLoading && setImageUrl(histImgSrc); }}
                      disabled={isLoading}
                      className="aspect-square rounded-md overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary focus:outline-none transition-all"
                      aria-label={`View generated image ${index + 1} from history`}
                    >
                      <Image
                        src={histImgSrc}
                        alt={`History image ${index + 1}`}
                        width={100}
                        height={100}
                        className="h-full w-full object-cover"
                        data-ai-hint="history thumbnail"
                      />
                    </button>
                  ))}
                </div>
              </CardFooter>
            </>
          )}
        </Card>
        <footer className="mt-8 sm:mt-12 text-center text-sm text-muted-foreground">
          {currentYear !== null ? <p>&copy; {currentYear} PhotoGenius. All rights reserved.</p> : <div className="h-4 w-48 bg-muted-foreground/20 mx-auto rounded animate-pulse"></div>}
        </footer>
      </div>
    </main>
  );
}
