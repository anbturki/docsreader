// The panel collapses to the rail, so icon-mode's square menu buttons would
// crush these stacked icon-over-label items back into icons alone.
//
// Every state is foreground colour only: muted at rest, bright when hovered,
// pressed or selected. The menu button's own states are opaque neutral fills
// plus a weight change, all built for the sidebar surface; on the accent its
// press fill reads as a white flash for as long as the button is held. Each is
// cancelled at its own modifier, which is what lets tailwind-merge drop it
// instead of leaving two rules to race. Keyboard focus keeps the ring, since
// it is the one state colour alone cannot carry, recoloured because a neutral
// ring disappears against the accent.
export const RAIL_ITEM =
  "h-auto flex-col gap-0.5 p-1 text-center text-2xs font-light whitespace-nowrap text-primary-fixed-foreground/60 group-data-[collapsible=icon]:size-full! group-data-[collapsible=icon]:p-1! hover:bg-transparent hover:text-primary-fixed-foreground active:bg-transparent active:text-primary-fixed-foreground data-active:bg-transparent data-active:font-light data-active:text-primary-fixed-foreground focus-visible:ring-primary-fixed-foreground";
