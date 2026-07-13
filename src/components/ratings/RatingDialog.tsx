import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

type RatingTarget = "doctor" | "hospital";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorName: string;
  hospitalName: string;
  onSubmitDoctor: (rating: number, review: string) => Promise<void>;
  onSubmitHospital: (rating: number, review: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const RatingDialog = ({
  open,
  onOpenChange,
  doctorName,
  hospitalName,
  onSubmitDoctor,
  onSubmitHospital,
  isSubmitting = false,
}: RatingDialogProps) => {
  const [currentTarget, setCurrentTarget] = useState<RatingTarget>("doctor");
  const [doctorRating, setDoctorRating] = useState(0);
  const [doctorReview, setDoctorReview] = useState("");
  const [hospitalRating, setHospitalRating] = useState(0);
  const [hospitalReview, setHospitalReview] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);

  const rating = currentTarget === "doctor" ? doctorRating : hospitalRating;
  const setRating = currentTarget === "doctor" ? setDoctorRating : setHospitalRating;
  const review = currentTarget === "doctor" ? doctorReview : hospitalReview;
  const setReview = currentTarget === "doctor" ? setDoctorReview : setHospitalReview;
  const targetName = currentTarget === "doctor" ? doctorName : hospitalName;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    if (currentTarget === "doctor") {
      await onSubmitDoctor(doctorRating, doctorReview);
      // Move to hospital rating
      setCurrentTarget("hospital");
    } else {
      await onSubmitHospital(hospitalRating, hospitalReview);
      // Reset and close
      resetState();
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    if (currentTarget === "doctor") {
      // Skip doctor rating, move to hospital
      setCurrentTarget("hospital");
    } else {
      // Skip hospital rating, close dialog
      resetState();
      onOpenChange(false);
    }
  };

  const resetState = () => {
    setCurrentTarget("doctor");
    setDoctorRating(0);
    setDoctorReview("");
    setHospitalRating(0);
    setHospitalReview("");
    setHoveredRating(0);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            {currentTarget === "doctor" ? (
              <div className="p-3 rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
            ) : (
              <div className="p-3 rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
          </div>
          <DialogTitle className="text-center">
            Rate {currentTarget === "doctor" ? "Doctor" : "Hospital"}
          </DialogTitle>
          <DialogDescription className="text-center">
            How was your experience with {targetName}?
          </DialogDescription>
          
          {/* Progress indicator */}
          <div className="flex justify-center gap-2 mt-3">
            <div className={cn(
              "h-2 w-8 rounded-full transition-colors",
              currentTarget === "doctor" ? "bg-primary" : "bg-muted"
            )} />
            <div className={cn(
              "h-2 w-8 rounded-full transition-colors",
              currentTarget === "hospital" ? "bg-primary" : "bg-muted"
            )} />
          </div>
        </DialogHeader>

        <div className="py-6">
          {/* Star Rating */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded-full p-1"
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
              >
                <Star
                  className={cn(
                    "h-10 w-10 transition-colors",
                    star <= displayRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
          </div>

          {/* Rating Label */}
          {displayRating > 0 && (
            <p className="text-center text-sm text-muted-foreground mb-4">
              {displayRating === 1 && "Poor"}
              {displayRating === 2 && "Fair"}
              {displayRating === 3 && "Good"}
              {displayRating === 4 && "Very Good"}
              {displayRating === 5 && "Excellent"}
            </p>
          )}

          {/* Optional Review */}
          <div className="space-y-2">
            <label htmlFor="review" className="text-sm font-medium">
              Share your experience (optional)
            </label>
            <Textarea
              id="review"
              placeholder={`Tell us about your experience with ${currentTarget === "doctor" ? "the doctor" : "the hospital"}...`}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {review.length}/500
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="sm:flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className="sm:flex-1"
          >
            {isSubmitting 
              ? "Submitting..." 
              : currentTarget === "doctor" 
                ? "Next: Rate Hospital" 
                : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};