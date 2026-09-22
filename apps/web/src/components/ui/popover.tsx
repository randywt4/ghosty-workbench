"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "~/lib/utils";
import {
  GLASS_POPOVER_CONTENT_CLASS_NAME,
  GLASS_POPOVER_FRAME_CLASS_NAME,
  GlassBackdrop,
} from "~/components/monocode/glassPopoverFrame";

const PopoverCreateHandle = PopoverPrimitive.createHandle;

const Popover = PopoverPrimitive.Root;

function PopoverTrigger({ className, children, ...props }: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverPrimitive.Trigger className={className} data-slot="popover-trigger" {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  );
}

function PopoverPopup({
  children,
  className,
  positionerClassName,
  viewportClassName,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  collisionAvoidance,
  tooltipStyle = false,
  anchor,
  ...props
}: PopoverPrimitive.Popup.Props & {
  positionerClassName?: string;
  viewportClassName?: string;
  side?: PopoverPrimitive.Positioner.Props["side"];
  align?: PopoverPrimitive.Positioner.Props["align"];
  sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: PopoverPrimitive.Positioner.Props["alignOffset"];
  collisionAvoidance?: PopoverPrimitive.Positioner.Props["collisionAvoidance"];
  tooltipStyle?: boolean;
  anchor?: PopoverPrimitive.Positioner.Props["anchor"];
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        collisionAvoidance={collisionAvoidance}
        className={cn(
          "z-[130] h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-transform data-instant:transition-none",
          positionerClassName,
        )}
        data-slot="popover-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            GLASS_POPOVER_FRAME_CLASS_NAME,
            "relative flex h-(--popup-height,auto) w-(--popup-width,auto) outline-none transition-[width,height] has-data-[slot=calendar]:rounded-xl",
            tooltipStyle && "w-fit text-balance text-xs",
            className,
          )}
          data-slot="popover-popup"
          {...props}
        >
          <GlassBackdrop />
          <PopoverPrimitive.Viewport
            className={cn(
              "popover-open size-full max-h-(--available-height) origin-(--transform-origin) overflow-clip px-(--viewport-inline-padding) py-4 [--viewport-inline-padding:--spacing(4)] has-data-[slot=calendar]:p-2 data-instant:transition-none **:data-current:data-ending-style:opacity-0 **:data-current:data-starting-style:opacity-0 **:data-previous:data-ending-style:opacity-0 **:data-previous:data-starting-style:opacity-0 **:data-current:w-[calc(var(--popup-width)-2*var(--viewport-inline-padding)-2px)] **:data-previous:w-[calc(var(--popup-width)-2*var(--viewport-inline-padding)-2px)] **:data-current:opacity-100 **:data-previous:opacity-100 **:data-current:transition-opacity **:data-previous:transition-opacity",
              GLASS_POPOVER_CONTENT_CLASS_NAME,
              tooltipStyle
                ? "py-1 [--viewport-inline-padding:--spacing(2)]"
                : "not-data-transitioning:overflow-y-auto",
              viewportClassName,
            )}
            data-slot="popover-viewport"
          >
            {children}
          </PopoverPrimitive.Viewport>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      className={cn("font-semibold text-lg leading-none", className)}
      data-slot="popover-title"
      {...props}
    />
  );
}

export {
  PopoverCreateHandle,
  Popover,
  PopoverTrigger,
  PopoverPopup,
  PopoverPopup as PopoverContent,
  PopoverTitle,
  PopoverClose,
};
