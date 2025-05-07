
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary", // Base background
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
         "h-full w-full flex-1 bg-primary transition-all", // Indicator color
         // Add conditional classes for different value ranges if needed
         // e.g., value && value > 75 ? "bg-green-500" : "bg-primary"
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
     {/* Optional: Add text display inside or outside the bar */}
     {/* Example: Absolute positioned text inside */}
     {/* <span
       className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground mix-blend-screen"
     >
       {value}%
     </span> */}
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
