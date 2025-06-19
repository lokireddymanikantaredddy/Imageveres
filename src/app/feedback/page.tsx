"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

interface FeedbackEntry {
  id: string;
  name: string;
  rating?: number;
  feedbackText: string;
  imageUrl: string;
  timestamp: string;
}

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeedback() {
      try {
        const response = await fetch('/api/feedback');
        if (!response.ok) {
          throw new Error('Failed to fetch feedback');
        }
        const data = await response.json();
        setFeedback(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feedback');
      } finally {
        setLoading(false);
      }
    }

    fetchFeedback();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading feedback...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">User Feedback</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {feedback.map((entry) => (
          <Card key={entry.id} className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{entry.name}</span>
                {entry.rating && (
                  <div className="flex items-center">
                    {Array.from({ length: entry.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                )}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {new Date(entry.timestamp).toLocaleDateString()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-square w-full mb-4 overflow-hidden rounded-lg border border-primary/30">
                <img
                  src={entry.imageUrl}
                  alt="Generated image"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="text-sm">{entry.feedbackText}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 