import { z } from "zod";

// Common validation schemas for input validation

export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s-]{10,15}$/, { message: "Invalid phone number" })
  .optional()
  .or(z.literal(""));

export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Name must be at least 2 characters" })
  .max(100, { message: "Name must be less than 100 characters" });

export const passwordSchema = z
  .string()
  .min(6, { message: "Password must be at least 6 characters" })
  .max(128, { message: "Password must be less than 128 characters" });

export const specialInstructionsSchema = z
  .string()
  .trim()
  .max(1000, { message: "Instructions must be less than 1000 characters" })
  .optional()
  .or(z.literal(""));

export const reviewSchema = z.object({
  rating: z
    .number()
    .min(1, { message: "Rating must be at least 1" })
    .max(5, { message: "Rating must be at most 5" }),
  review: z
    .string()
    .trim()
    .max(2000, { message: "Review must be less than 2000 characters" })
    .optional()
    .or(z.literal("")),
});

export const bookingSchema = z.object({
  doctorId: z.string().uuid({ message: "Invalid doctor ID" }),
  hospitalId: z.string().uuid({ message: "Invalid hospital ID" }),
  appointmentDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
  appointmentTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
      message: "Invalid time format",
    }),
  appointmentType: z.enum(["consultation", "follow-up", "emergency"]),
  specialInstructions: specialInstructionsSchema,
});

export const profileSchema = z.object({
  fullName: nameSchema.optional(),
  phone: phoneSchema,
  address: z
    .string()
    .trim()
    .max(500, { message: "Address must be less than 500 characters" })
    .optional()
    .or(z.literal("")),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""])
    .optional(),
  allergies: z
    .string()
    .trim()
    .max(1000, { message: "Allergies must be less than 1000 characters" })
    .optional()
    .or(z.literal("")),
  medicalHistory: z
    .string()
    .trim()
    .max(5000, { message: "Medical history must be less than 5000 characters" })
    .optional()
    .or(z.literal("")),
  emergencyContact: nameSchema.optional().or(z.literal("")),
  emergencyPhone: phoneSchema,
  insuranceProvider: z
    .string()
    .trim()
    .max(200, { message: "Provider name must be less than 200 characters" })
    .optional()
    .or(z.literal("")),
  insuranceNumber: z
    .string()
    .trim()
    .max(100, { message: "Policy number must be less than 100 characters" })
    .optional()
    .or(z.literal("")),
});

// Utility function to safely encode URL parameters
export const safeEncodeURIComponent = (value: string): string => {
  return encodeURIComponent(value.trim().slice(0, 500));
};

// Sanitize text input (basic XSS prevention)
export const sanitizeText = (input: string): string => {
  return input
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 10000);
};
