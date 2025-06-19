
"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  maxStars?: number;
  disabled?: boolean;
  size?: number; // size of the star icon
}

export function StarRatingInput({
  value,
  onChange,
  maxStars = 5,
  disabled = false,
  size = 24, // default size 24px
}: StarRatingInputProps) {
  const [hoverRating, setHoverRating] = React.useState(0);

  const handleStarClick = (ratingValue: number) => {
    if (disabled) return;
    onChange(ratingValue === value ? 0 : ratingValue); // Allow unsetting by clicking current rating
  };

  const handleStarHover = (ratingValue: number) => {
    if (disabled) return;
    setHoverRating(ratingValue);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    setHoverRating(0);
  };

  return (
    <div className="flex items-center space-x-1" onMouseLeave={handleMouseLeave} role="radiogroup" aria-label="Star rating">
      {[...Array(maxStars)].map((_, index) => {
        const ratingValue = index + 1;
        const isFilled = ratingValue <= (hoverRating || value);
        
        return (
          <button
            type="button"
            key={ratingValue}
            onClick={() => handleStarClick(ratingValue)}
            onMouseEnter={() => handleStarHover(ratingValue)}
            disabled={disabled}
            className={cn(
              "cursor-pointer p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              disabled && "cursor-not-allowed opacity-50"
            )}
            role="radio"
            aria-checked={ratingValue === value}
            aria-label={`${ratingValue} out of ${maxStars} stars`}
            aria-posinset={ratingValue}
            aria-setsize={maxStars}
          >
            <Star
              className={cn(
                "transition-colors duration-150 ease-in-out",
                isFilled ? "text-yellow-400" : "text-muted-foreground/50"
              )}
              fill={isFilled ? "currentColor" : "none"}
              style={{ width: size, height: size }}
            />
          </button>
        );
      })}
    </div>
  );
}
