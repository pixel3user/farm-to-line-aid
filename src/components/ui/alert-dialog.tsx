import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { emitDialogToggle } from "@/lib/dialogEvents";

type AlertDialogRootProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Root>;

const AlertDialog = ({ open, defaultOpen, onOpenChange, ...props }: AlertDialogRootProps) => {
  const dialogId = React.useId();
  const initialOpen = Boolean(open ?? defaultOpen);
  const lastOpenRef = React.useRef(initialOpen);

  React.useEffect(() => {
    if (lastOpenRef.current) {
      emitDialogToggle(dialogId, true);
    }
  }, [dialogId]);

  React.useEffect(() => {
    if (open === undefined) return;
    if (lastOpenRef.current === open) return;
    lastOpenRef.current = open;
    emitDialogToggle(dialogId, open);
  }, [dialogId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (lastOpenRef.current !== nextOpen) {
      lastOpenRef.current = nextOpen;
      emitDialogToggle(dialogId, nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <AlertDialogPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={handleOpenChange}
      {...props}
    />
  );
};

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[60] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, onScroll, ...props }, ref) => {
  const [scrolled, setScrolled] = React.useState(false);
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const next = event.currentTarget.scrollTop > 8;
      setScrolled((prev) => (prev === next ? prev : next));
      onScroll?.(event);
    },
    [onScroll],
  );

  const childArray = React.Children.toArray(props.children);
  const headerIndex = childArray.findIndex(
    (child) =>
      React.isValidElement(child) &&
      (child.type as { displayName?: string }).displayName === "AlertDialogHeader",
  );
  const header = headerIndex >= 0 ? childArray[headerIndex] : null;
  const bodyChildren = headerIndex >= 0 ? childArray.filter((_, index) => index !== headerIndex) : childArray;
  const hasHeader = Boolean(header);

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        data-scrolled={scrolled}
        onScroll={hasHeader ? undefined : handleScroll}
        className={cn(
          "group fixed left-[50%] top-[50%] z-[60] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[100dvh]",
          hasHeader
            ? "flex flex-col overflow-hidden p-0"
            : "grid gap-4 p-6 overflow-y-auto overflow-x-hidden",
          className,
        )}
        {...props}
      >
        {hasHeader ? (
          <>
            {header}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 pt-4" onScroll={handleScroll}>
              {bodyChildren}
            </div>
          </>
        ) : (
          props.children
        )}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 border-b bg-background/95 px-6 pt-6 pb-4 text-center backdrop-blur transition-all sm:text-left",
      className,
      "group-data-[scrolled=true]:pt-4 group-data-[scrolled=true]:pb-3",
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn(
      className,
      "text-2xl font-bold leading-none tracking-tight transition-all group-data-[scrolled=true]:text-xl",
    )}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn(
      className,
      "text-base text-muted-foreground transition-all group-data-[scrolled=true]:text-sm",
    )}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
