import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Controller, FormProvider, type FieldValues } from "react-hook-form";

import { cn } from "@/lib/utils";

export const Form = FormProvider;

export const FormField = <TFieldValues extends FieldValues, TName extends string>({
  control,
  name,
  render
}: {
  control: any;
  name: TName;
  render: ({ field }: { field: any }) => React.ReactNode;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => <>{render({ field })}</>}
  />
);

export const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div ref={ref} className="flex flex-col space-y-2" {...props} />
));
FormItem.displayName = "FormItem";

export const FormLabel = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(
  ({ className, ...props }, ref) => <Slot ref={ref} className={cn("text-sm font-medium", className)} {...props} />
);
FormLabel.displayName = "FormLabel";

export const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(
  ({ className, ...props }, ref) => <Slot ref={ref} className={cn(className)} {...props} />
);
FormControl.displayName = "FormControl";

export const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>((props, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", props.className)} {...props} />
));
FormDescription.displayName = "FormDescription";

export const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>((props, ref) => (
  <p ref={ref} className={cn("text-sm text-destructive", props.className)} {...props} />
));
FormMessage.displayName = "FormMessage";
