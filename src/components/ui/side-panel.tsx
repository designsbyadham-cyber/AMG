'use client';

import * as React from 'react';
import { Dialog as PanelPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A right-hand inspector panel.
 *
 * Unlike the modal sheet it replaces, this never blurs or dims the page
 * it came from. On a wide screen the app's content column gives up
 * horizontal room — the panel publishes its width as `--panel-inset`,
 * which `.panel-host` in globals.css turns into a margin — so the
 * record being edited sits *beside* the list it was picked from rather
 * than on top of a smeared copy of it.
 *
 * That also means the panel is deliberately non-modal on desktop:
 * nothing is trapped, nothing is hidden, and an outside click does not
 * dismiss (the explicit close button does). Below `lg` there is no room
 * to give up, so it degrades to a full-width sheet over a plain scrim
 * with normal modal behaviour.
 */

const PANEL_WIDTHS = {
  sm: '26rem',
  md: '32rem',
  lg: '38rem',
} as const;

export type PanelWidth = keyof typeof PANEL_WIDTHS;

const PanelWidthContext = React.createContext<PanelWidth>('md');

/** lg — below this the content column has no room to yield. */
const PUSH_QUERY = '(min-width: 1024px)';

function useCanPush() {
  const [canPush, setCanPush] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(PUSH_QUERY);
    const sync = () => setCanPush(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return canPush;
}

/**
 * Publish the open panel's width to the document so the shell can make
 * room. Always cleaned up on close, including when the component
 * unmounts mid-transition.
 */
function usePanelInset(open: boolean, width: PanelWidth) {
  React.useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.setProperty('--panel-inset', PANEL_WIDTHS[width]);
    return () => {
      root.style.setProperty('--panel-inset', '0rem');
    };
  }, [open, width]);
}

interface SidePanelProps extends PanelPrimitive.Root.Props {
  width?: PanelWidth;
}

function SidePanel({ width = 'md', open, ...props }: SidePanelProps) {
  const canPush = useCanPush();
  usePanelInset(Boolean(open), width);

  return (
    <PanelWidthContext.Provider value={width}>
      <PanelPrimitive.Root
        data-slot="side-panel"
        open={open}
        // Non-modal while pushing: the list behind stays readable and
        // usable, which is the entire point of making room for the panel.
        modal={!canPush}
        disablePointerDismissal={canPush}
        {...props}
      />
    </PanelWidthContext.Provider>
  );
}

function SidePanelClose({ ...props }: PanelPrimitive.Close.Props) {
  return <PanelPrimitive.Close data-slot="side-panel-close" {...props} />;
}

/** Scrim for the mobile fallback only. Plain dim, no blur. */
function SidePanelScrim({ className, ...props }: PanelPrimitive.Backdrop.Props) {
  return (
    <PanelPrimitive.Backdrop
      data-slot="side-panel-scrim"
      className={cn(
        'fixed inset-0 z-40 bg-foreground/20 transition-opacity duration-200 lg:hidden',
        'data-ending-style:opacity-0 data-starting-style:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function SidePanelContent({
  className,
  children,
  ...props
}: PanelPrimitive.Popup.Props) {
  const width = React.useContext(PanelWidthContext);

  return (
    <PanelPrimitive.Portal>
      <SidePanelScrim />
      <PanelPrimitive.Popup
        data-slot="side-panel-content"
        style={{ ['--panel-width' as string]: PANEL_WIDTHS[width] }}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-card text-sm text-foreground',
          'border-l border-border shadow-[-16px_0_40px_-24px_rgb(0_0_0/0.28)]',
          'lg:w-[var(--panel-width)]',
          // Slide, no fade-to-blur. Exponential ease-out so it settles
          // rather than stopping.
          // Explicit resting transform: the open state must not depend on an
          // attribute being removed, only the entry/exit offsets should.
          'translate-x-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          'data-ending-style:translate-x-full data-starting-style:translate-x-full',
          'motion-reduce:transition-none',
          className,
        )}
        {...props}
      >
        {children}
      </PanelPrimitive.Popup>
    </PanelPrimitive.Portal>
  );
}

/**
 * Sticky panel header. Owns the close button so it sits in the layout
 * instead of floating over whatever scrolls beneath it.
 */
function SidePanelHeader({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="side-panel-header"
      className={cn(
        'flex items-start gap-3 border-b border-border px-5 py-4',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <SidePanelClose
        className="-mr-1 -mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Close panel"
      >
        <XIcon className="size-4" />
      </SidePanelClose>
    </div>
  );
}

function SidePanelTitle({ className, ...props }: PanelPrimitive.Title.Props) {
  return (
    <PanelPrimitive.Title
      data-slot="side-panel-title"
      className={cn(
        'truncate font-heading text-base font-semibold text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function SidePanelDescription({
  className,
  ...props
}: PanelPrimitive.Description.Props) {
  return (
    <PanelPrimitive.Description
      data-slot="side-panel-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Bottom action bar that stays put while the body scrolls. */
function SidePanelFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="side-panel-footer"
      className={cn(
        'mt-auto flex items-center gap-2 border-t border-border bg-card px-5 py-3',
        className,
      )}
      {...props}
    />
  );
}

export {
  SidePanel,
  SidePanelClose,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
};
