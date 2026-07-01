import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, style, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      style={{
        width: "20px",
        height: "20px",
        minWidth: "20px",
        minHeight: "20px",
        maxWidth: "20px",
        maxHeight: "20px",
        borderRadius: "9999px",
        WebkitAppearance: "none",
        MozAppearance: "none",
        appearance: "none",
        WebkitBorderRadius: "9999px",
        padding: 0,
        lineHeight: 1,
        ...style,
      }}
      className={cn(
        "shrink-0 inline-flex items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-transparent text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className="flex h-full w-full items-center justify-center"
        style={{ borderRadius: "9999px" }}
      >
        <span
          aria-hidden="true"
          className="block rounded-full bg-current"
          style={{ width: "10px", height: "10px", minWidth: "10px", minHeight: "10px" }}
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
