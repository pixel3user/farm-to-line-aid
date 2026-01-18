import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { emitDialogToggle } from "@/lib/dialogEvents";

type DialogRootProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;

const Dialog = ({ open, defaultOpen, onOpenChange, ...props }: DialogRootProps) => {
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
    <DialogPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={handleOpenChange}
      {...props}
    />
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[60] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onScroll, ...props }, ref) => {
  const [scrolled, setScrolled] = React.useState(false);
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const next = event.currentTarget.scrollTop > 8;
      setScrolled((prev) => (prev === next ? prev : next));
      onScroll?.(event);
    },
    [onScroll],
  );
  const childArray = React.Children.toArray(children);
  const headerIndex = childArray.findIndex(
    (child) =>
      React.isValidElement(child) && (child.type as { displayName?: string }).displayName === "DialogHeader",
  );
  const header = headerIndex >= 0 ? childArray[headerIndex] : null;
  const bodyChildren = headerIndex >= 0 ? childArray.filter((_, index) => index !== headerIndex) : childArray;
  const hasHeader = Boolean(header);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
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
          children
        )}
        <DialogPrimitive.Close className="absolute right-6 top-6 rounded-sm opacity-70 ring-offset-background transition-all data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none group-data-[scrolled=true]:top-4">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 border-b bg-background/95 px-6 pt-6 pb-4 pr-12 text-center backdrop-blur transition-all sm:text-left",
      className,
      "group-data-[scrolled=true]:pt-4 group-data-[scrolled=true]:pb-3",
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      className,
      "text-2xl font-bold leading-none tracking-tight transition-all group-data-[scrolled=true]:text-xl",
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      className,
      "text-base text-muted-foreground transition-all group-data-[scrolled=true]:text-sm",
    )}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
