import { z } from 'zod'

export const positiveIntParam = z.string()
  .transform((val) => parseInt(val, 10))
  .pipe(z.number().positive())
