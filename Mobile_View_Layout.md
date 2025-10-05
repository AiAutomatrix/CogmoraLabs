# Mobile View Layout Documentation

This document explains the mobile-first responsive layout of the Cogmora Labs application. The primary goal for mobile is to provide a user-friendly, single-column, vertically scrolling experience.

## Core Philosophy

On screens smaller than the 'lg' breakpoint (1024px), the application adopts a stacked, single-column layout. Content blocks are placed one after another vertically. This is achieved by using default mobile-first Tailwind CSS classes, which are then overridden for larger screens using the `lg:` prefix.

## Layout Structure (`src/app/dashboard/page.tsx`)

The structure is defined in the `HomePage` component.

```tsx
<main className="flex flex-col lg:flex-row flex-grow lg:min-h-0">
  {/* Main Content Section */}
  <section className="flex flex-col lg:w-2/3 lg:min-h-0">
    <MainViews ... />
  </section>

  {/* Sidebar/Webchat Section */}
  <aside className="flex flex-col lg:w-1/3 lg:border-l border-border min-h-[1000px] lg:min-h-0">
    <MiniWidgets ... />
  </aside>
</main>
```

### Key Tailwind Classes for Mobile:

-   **`flex flex-col`**: This is the default class on the `<main>` element. It ensures that its children, the `<section>` (Main View) and `<aside>` (Mini Widgets), are stacked vertically.
-   **`min-h-[1000px]`**: This class is applied to the `<aside>` element, which contains the `AiWebchat`. This gives the webchat container a large minimum height, pushing it down the page and making it feel like a distinct section you can scroll to.
-   **`min-h-[500px]`**: Applied within `MainViews.tsx` to the `TabsContent` for the chart and other views to ensure they have sufficient height to be usable on mobile.

## Component Behavior on Mobile

### Header & Navigation
- A mobile-specific header is displayed, containing the app title and a `Sheet` (slide-out menu) trigger.
- The `Sheet` provides a space-efficient way to navigate between all the main views (Paper Trading, Charts, Heatmaps, Screeners) using an `Accordion` menu.

### `MainViews.tsx`
- The main view content appears first. Instead of tabs, view selection is handled by the mobile navigation sheet.
- For multi-chart layouts, the charts are rendered in a **horizontal scrolling container** (a "carousel"), allowing the user to swipe left and right to see each full-sized chart.

### `MiniWidgets.tsx`
- This component, containing the AI chat and technical analysis, appears below the `MainViews` content.
- Because of the `min-h-[1000px]` on its container, it occupies a large vertical space. This makes the `AiWebchat` in particular feel like a native, full-screen experience when the user scrolls down to it.

This mobile-first approach ensures a natural, intuitive user experience on phones and tablets, prioritizing content readability and touch-friendly navigation.
