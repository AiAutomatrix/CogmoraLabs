# Mobile View Layout Documentation

This document explains the mobile-first responsive layout of the Cogmora Labs application. The primary goal for mobile is to provide a user-friendly, single-column, vertically scrolling experience, ensuring all content is accessible and readable on smaller screens.

## Core Philosophy

On screens smaller than the 'lg' breakpoint (1024px), the application adopts a stacked, single-column layout. Instead of trying to fit multiple columns, content blocks are placed one after another vertically. This is achieved by using default mobile-first Tailwind CSS classes, which are then overridden for larger screens using the `lg:` prefix.

## Layout Structure (`src/app/page.tsx`)

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

-   **`flex flex-col`**: This is the default class on the `<main>` element. It ensures that its children, the `<section>` (Main View) and `<aside>` (Mini Widgets), are stacked vertically, one on top of the other.
-   **`min-h-[1000px]`**: This class is applied to the `<aside>` element, which contains the `AiWebchat`. This is a key part of the mobile layout. It gives the webchat container a large minimum height, effectively "pushing" it down the page and making it feel like a distinct section you can scroll to. This provides a large, usable area for the chat interface, which would otherwise be squished.

## Component Behavior on Mobile

### `MainViews.tsx`
-   The main view content appears first. To handle the numerous views (Charts, Heatmaps, Screeners) on a small screen, a **responsive `DropdownMenu`** is used instead of tabs. This saves a significant amount of screen real estate.
-   For multi-chart layouts, the charts are rendered in a **horizontal scrolling container** (a "carousel"). This allows the user to swipe left and right to see each full-sized chart without cluttering the screen. This is achieved with `flex overflow-x-auto snap-x snap-mandatory`.

### `MiniWidgets.tsx`
-   This component, containing the webchat and technical analysis, appears below the `MainViews`.
-   Because of the `min-h-[1000px]` on its container, it occupies a large vertical space, inviting the user to scroll down to interact with it. The internal components are set to fill this space, making the webchat in particular feel like a native, full-screen experience when the user scrolls to it.

This mobile-first approach ensures a natural, intuitive user experience on phones and tablets, prioritizing content readability and touch-friendly navigation.
