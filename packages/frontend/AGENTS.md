# Frontend standards

These apply to work in `packages/frontend`, in addition to the root
[AGENTS.md](../../AGENTS.md). If anything here conflicts with the working
agreement in the root file, the working agreement wins.

## Role
You are a React frontend development specialist.

## Tech stack
- React 18 with TypeScript 5
- Vite 6 (dev server and build); the dev server proxies `/api` and `/s/` to the backend
- react-router-dom 6 for routing
- Plain CSS (`src/App.css`, `src/index.css`)
- Component state with React hooks only; no state management library
- Vitest for tests (see Testing)

## Component principles
- **Functional Components**: Use function components with hooks
- **Single Responsibility**: Each component should have one clear purpose
- **Composition over Inheritance**: Favor component composition
- **Props Interface**: Always define TypeScript interfaces for props
- **Default Props**: Provide sensible defaults when appropriate

## Hooks best practices
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Dependency Arrays**: Be explicit about useEffect dependencies
- **Performance**: Use useMemo and useCallback judiciously
- **State Management**: Keep state as local as possible

## File structure
```
src/
  main.tsx             # entry point
  App.tsx              # BrowserRouter and site shell; routes / and /labs/:slug
  App.css, index.css   # styles
  lib/
    http.ts            # request(): the shared fetch wrapper every lab's api.ts uses
  components/          # shared components used by more than one page
    ConceptTags.tsx    # the row of concept tags on lab cards and lab pages
    ErrorBoundary.tsx  # catches render errors (a class: React has no hook for this); see D-026
  pages/
    Home.tsx           # lab index, rendered from the registry
    LabPage.tsx        # one lab: live demo plus design write-up
  labs/
    registry.ts        # one entry per system: metadata and design notes
    types.ts           # the Lab type
    <slug>/            # one folder per lab, e.g. url-shortener/
      Demo.tsx         # the live demo, lazy-loaded from the registry; renders only
      use<Name>.ts     # that lab's data hook (e.g. useShortLinks): state and API calls
      api.ts           # that lab's API client
```

Adding a system means a new `labs/<slug>/` folder plus one entry in
`registry.ts` (see D-001 in [DECISIONS.md](../../DECISIONS.md)). Home and
LabPage render from the registry, so they don't change.

## Styling guidelines
- Use consistent spacing and typography
- Implement responsive design from the start
- Follow accessibility best practices
- Use CSS custom properties for theming

## Performance
- Lazy load components when appropriate
- Optimize bundle size with code splitting
- Use React.memo for expensive components
- Implement proper error boundaries

## Testing
- Use Vitest as the test runner (not yet installed or configured)
- Write unit tests for utility functions
- Test component behavior, not implementation
- Use React Testing Library for component tests
- Mock external dependencies appropriately
