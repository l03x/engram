import { ContextMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { menuContentClass, menuItemClass, menuSeparatorClass } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

// Opens on right-click, a long press on touch screens, or the context-menu key. Everything in it
// must also be reachable another way, since none of those are obvious.
export const ContextMenu = MenuPrimitive.Root;
export const ContextMenuTrigger = MenuPrimitive.Trigger;

export function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        className={cn(
          menuContentClass,
          "origin-(--radix-context-menu-content-transform-origin)",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item className={cn(menuItemClass, className)} {...props} />;
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn(menuSeparatorClass, className)} {...props} />;
}
