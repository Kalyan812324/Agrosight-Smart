import { z } from 'zod';

// Yield predictor form validation schema
export const yieldPredictorSchema = z.object({
  crop: z.string().min(1, "Crop is required"),
  state: z.string().min(1, "State is required"),
  district: z.string().optional(),
  soilType: z.string().min(1, "Soil type is required"),
  rainfall: z.number({
    required_error: "Rainfall is required",
    invalid_type_error: "Rainfall must be a number"
  })
    .positive("Rainfall must be a positive number")
    .max(15000, "Rainfall value seems unrealistic (max 15,000 mm)"),
  area: z.number({
    required_error: "Area is required",
    invalid_type_error: "Area must be a number"
  })
    .positive("Area must be a positive number")
    .max(100000, "Area value seems unrealistic (max 100,000 hectares)"),
  season: z.string().min(1, "Season is required"),
  temperature: z.number()
    .min(-50, "Temperature must be at least -50°C")
    .max(60, "Temperature must be at most 60°C")
    .optional(),
  humidity: z.number()
    .min(0, "Humidity must be at least 0%")
    .max(100, "Humidity must be at most 100%")
    .optional(),
  irrigationType: z.string().optional(),
  fertilizerUsage: z.string().optional(),
  previousCrop: z.string().optional()
});

export type YieldPredictorFormData = z.infer<typeof yieldPredictorSchema>;

// Weather location validation (for any future manual input)
export const locationSchema = z.object({
  latitude: z.number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
});

export type LocationData = z.infer<typeof locationSchema>;
