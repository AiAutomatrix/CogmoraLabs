# Desktop View Layout Documentation

This document outlines the structure and styling that creates the desktop-first, two-column layout for the TradeFlow application. The goal is a persistent, side-by-side view where the main content and sidebar widgets are always visible.

## Core Philosophy

On screens larger than the 'lg' breakpoint (1024px), the layout shifts from a single-column mobile view to a two-column split-screen. This is achieved primarily through responsive Tailwind CSS classes in `src/app/page.tsx`.

## Layout Structure (`src/app/page.tsx`)

The main layout is controlled by the `<main>` element within the `HomePage` component.

```tsx
<main className="flex flex-col lg:flex-row flex-grow lg:min-h-0">
  {/* Main Content Section */}
  <section className="flex flex-col lg:w-2/3 lg:min-h-0">
    <MainViews ... />
  </section>

  {/* Sidebar Section */}
  <aside className="flex flex-col lg:w-1/3 lg:border-l border-border min-h-[1000px] lg:min-h-0">
    <MiniWidgets ... />
  </aside>
</main>
```

### Key Tailwind Classes and Their Roles:

-   **`lg:flex-row`**: This is the crucial class. On large screens (`lg:`), it overrides the default `flex-col` and arranges the `<section>` (Main View) and `<aside>` (Mini Widgets/Sidebar) into a horizontal row.
-   **`lg:w-2/3` and `lg:w-1/3`**: These classes assign a proportional width to the main content and sidebar, creating the 2/3 and 1/3 split.
-   **`flex-grow`**: This ensures that the `<main>` element expands to fill any available vertical space within its parent container (`body` and `html`, which are set to `h-full`).
-   **`lg:min-h-0`**: This class is applied to both the `<main>` container and its direct children (`<section>` and `<aside>`). On large screens, it prevents the flex items from expanding beyond their flex-basis (the `lg:w-2/3` and `lg:w-1/3` properties), which is essential for allowing independent scrolling within each column if the content overflows.

## Component Behavior

### `MainViews.tsx`
-   On desktop, this component fills the entire `lg:w-2/3` container. The internal `Tabs` and `TabsContent` are configured to take up the full height of this section, allowing content like charts and screeners to expand fully.

### `MiniWidgets.tsx`
-   This component fills the `lg:w-1/3` sidebar. The `TabsContent` within it, particularly the `AiWebchat`, is set to be `flex-grow`, ensuring it fills all available vertical space in the sidebar. This makes the chat and technical analysis widgets feel integrated and properly sized.

This combination of responsive flexbox utilities creates a robust and professional-looking desktop experience that cleanly separates primary content from auxiliary tools.