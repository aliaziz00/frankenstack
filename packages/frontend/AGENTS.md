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
  (public/ holds static files: the favicon set is Twemoji artwork under CC-BY 4.0, credited in the README)
  App.tsx              # BrowserRouter and site shell; routes / and /labs/:slug
  App.css              # component styles; colours come from the tokens
  index.css            # global base and the colour tokens (light + dark)
  tokens.test.ts       # checks the tokens' contrast and that App.css uses only tokens
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
- Use CSS custom properties for theming. Every colour in `App.css` is a token defined in `src/index.css`: light values on `:root`, with a `prefers-color-scheme: dark` block that overrides only what must differ. The page follows the system setting; there is no manual toggle. The one literal allowed in `App.css` is `white` as button text on `var(--accent)`.
- Colours must meet WCAG AA: 4.5:1 for text and 3:1 for the edge of a form control, against the real page background (`#ffffff` light, `#121212` dark), in both schemes. Muted text uses `opacity`, which is fine (all current values pass); use `--border` only for decorative edges and `--border-strong` for controls.
- Change a palette value together with `src/tokens.test.ts`, which reads the tokens and fails if a contrast target is missed, a token is undefined, or a hard-coded colour appears in `App.css`. Measure real rendered colours in the browser in both schemes (emulate the colour scheme) rather than trusting the numbers.

## Performance
- Lazy load components when appropriate
- Optimize bundle size with code splitting
- Use React.memo for expensive components
- Implement proper error boundaries

## Testing
- Vitest is the test runner (`npm test`, or `npm run test:watch`). Tests sit next to the code as `*.test.ts` and import `describe`/`it`/`expect` explicitly (no globals). They run in a Node environment for now; jsdom and React Testing Library are added with the first component test.
- Write unit tests for utility functions. Covered so far: `lib/http.ts` (`request()`).
- Test component behavior, not implementation
- Use React Testing Library for component tests (not yet installed)
- Mock external dependencies appropriately: replace `fetch` with `vi.stubGlobal` and restore it with `vi.unstubAllGlobals()` in `afterEach`.
- Expected values in a test must come from an independent source (a hand calculation, another tool), never from the function under test. Check that a new test can fail by breaking the code on purpose, applying each mutation in isolation and restoring the file afterwards.
