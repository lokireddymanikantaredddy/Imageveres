"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Sparkles, Download, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { handleGeneratePhotoAction, type PhotoGenerationResult } from "./actions";
import { useToast } from "@/hooks/use-toast";


const formSchema = z.object({
  prompt: z.string().min(10, {
    message: "Prompt must be at least 10 characters.",
  }).max(1000, {
    message: "Prompt must not exceed 1000 characters."
  }),
});

export default function PhotoGeniusPage() {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setImageUrl(null);
    setError(null);

    try {
      const result: PhotoGenerationResult = await handleGeneratePhotoAction(values);
      if (result.success && result.data) {
        setImageUrl(result.data);
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
    
    // Extract file extension from MIME type, default to png
    let extension = 'png';
    try {
      const mimeTypeMatch = imageUrl.match(/^data:(image\/[^;]+);base64,/);
      if (mimeTypeMatch && mimeTypeMatch[1]) {
        const mimeType = mimeTypeMatch[1];
        extension = mimeType.split('/')[1] || 'png';
      }
    } catch (e) {
      // fallback to png if regex or split fails
      console.warn("Could not determine image extension from data URI, defaulting to png.", e)
    }

    link.download = `photogenius-art.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Effect to ensure client-side only execution for date
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
                          rows={4}
                          aria-describedby="prompt-form-message"
                        />
                      </FormControl>
                      <FormMessage id="prompt-form-message" />
                    </FormItem>
                  )}
                />
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

            {error && !isLoading && ( // Only show this specific alert if not loading and error exists
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
        </Card>
        <footer className="mt-8 sm:mt-12 text-center text-sm text-muted-foreground">
          {currentYear !== null ? <p>&copy; {currentYear} PhotoGenius. All rights reserved.</p> : <div className="h-4 w-48 bg-muted-foreground/20 mx-auto rounded animate-pulse"></div>}
        </footer>
      </div>
    </main>
  );
}
