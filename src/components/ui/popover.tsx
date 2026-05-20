import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, forwardedRef) => {
  const localRef = React.useRef<HTMLDivElement | null>(null);

  const setRefs = React.useCallback(
    (node: any) => {
      localRef.current = node;
      if (forwardedRef) {
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else {
          (forwardedRef as any).current = node;
        }
      }
    },
    [forwardedRef]
  );

  React.useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const stopPropagation = (e: Event) => {
      e.stopPropagation();
    };
    el.addEventListener("wheel", stopPropagation, { passive: false });
    el.addEventListener("touchmove", stopPropagation, { passive: false });
    return () => {
      el.removeEventListener("wheel", stopPropagation);
      el.removeEventListener("touchmove", stopPropagation);
    };
  }, []);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={setRefs}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
