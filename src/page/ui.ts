// shadcn component recipes as class strings, taken from MyIP's
// frontend/components/ui so the page shares its interaction rules (sizes,
// focus rings, hover states). Every class is written out in full here for
// Tailwind to find; never assemble one from pieces.

/* ── Button ────────────────────────────────────────────────────── */

const BUTTON_BASE =
    'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

const BUTTON_VARIANTS = {
    outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
} as const;

// `xs` is the inline size for a button inside a line of terminal output.
const BUTTON_SIZES = {
    sm: 'h-8 px-3 text-xs',
    xs: 'h-6 px-1.5 text-xs',
} as const;

export const buttonClass = (variant: keyof typeof BUTTON_VARIANTS, size: keyof typeof BUTTON_SIZES): string =>
    `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;

/* ── Tabs ──────────────────────────────────────────────────────── */

export const TABS_LIST = 'inline-flex h-8 w-fit items-center justify-center rounded-lg bg-muted p-0.75 text-muted-foreground';
export const TABS_TRIGGER =
    'inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-xs font-medium text-foreground transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-background data-[state=active]:shadow-sm dark:text-muted-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground';
