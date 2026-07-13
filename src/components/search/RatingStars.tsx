import { Star } from "lucide-react";

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
}

export const RatingStars = ({
  rating,
  maxRating = 5,
  size = "md",
  showNumber = false,
}: RatingStarsProps) => {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxRating }).map((_, index) => {
        const isFilled = index < fullStars;
        const isHalf = index === fullStars && hasHalfStar;

        return (
          <Star
            key={index}
            className={`${sizeClasses[size]} ${
              isFilled || isHalf
                ? "fill-warning text-warning"
                : "text-muted"
            }`}
          />
        );
      })}
      {showNumber && (
        <span className="text-sm font-semibold ml-1">{rating.toFixed(1)}</span>
      )}
    </div>
  );
};