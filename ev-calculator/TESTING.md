# Testing Documentation

## Overview

This project includes a comprehensive test suite using **Vitest** and **React Testing Library** to ensure code quality and reliability.

## Test Structure

```
src/tests/
├── setup.js                           # Test environment configuration
├── SEO.test.jsx                       # SEO component tests
├── App.test.jsx                       # Main App component tests
├── EVChargingCalculator.test.jsx      # EV charging calculator tests
├── LifetimeCostCalculator.test.jsx    # Lifetime cost calculator tests
└── utils.test.js                      # Utility function tests
```

## Running Tests

### Run all tests in watch mode
```bash
npm test
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests once (CI mode)
```bash
npm run test:run
```

### Generate coverage report
```bash
npm run test:coverage
```

## Test Coverage

The test suite covers:

### 1. **SEO Component** (`SEO.test.jsx`)
- ✅ Default prop rendering
- ✅ Page title setting
- ✅ Meta description and keywords
- ✅ Open Graph tags (Facebook)
- ✅ Twitter Card tags
- ✅ Canonical URL
- ✅ Custom meta tags

### 2. **App Component** (`App.test.jsx`)
- ✅ Component rendering
- ✅ Navigation links
- ✅ Dark mode toggle functionality
- ✅ LocalStorage management
- ✅ Navbar hide/show on scroll
- ✅ Route navigation
- ✅ Initial dark mode state

### 3. **EV Charging Calculator** (`EVChargingCalculator.test.jsx`)
- ✅ Component rendering
- ✅ Input controls (sliders, number inputs)
- ✅ Battery capacity management
- ✅ SOC (State of Charge) range validation
- ✅ Charging time calculations
- ✅ Cost calculations
- ✅ Charging curve visualization
- ✅ Vehicle presets
- ✅ Custom curve editing
- ✅ Dark mode support
- ✅ Efficiency calculations

### 4. **Lifetime Cost Calculator** (`LifetimeCostCalculator.test.jsx`)
- ✅ Gas vehicle cost calculations
- ✅ Electric vehicle cost calculations
- ✅ Fuel efficiency controls
- ✅ Cost comparison visualization
- ✅ CO2 emissions calculations
- ✅ Environmental impact metrics
- ✅ Currency selection
- ✅ Unit system toggle (Imperial/Metric)
- ✅ Maintenance cost tracking
- ✅ Break-even analysis
- ✅ Total ownership costs
- ✅ Battery replacement costs
- ✅ Insurance costs
- ✅ Offset equivalencies

### 5. **Utility Functions** (`utils.test.js`)
- ✅ Unit conversions (gallons↔liters, miles↔km, kg↔lbs)
- ✅ Energy calculations
- ✅ Charging time calculations
- ✅ Cost calculations
- ✅ CO2 emissions calculations
- ✅ Battery manufacturing emissions
- ✅ Grid electricity emissions
- ✅ Efficiency calculations (MPGe)
- ✅ SOC validation and calculations
- ✅ Time formatting
- ✅ Currency formatting
- ✅ Number formatting
- ✅ Environmental offset calculations
- ✅ Input validation
- ✅ Value clamping

## Key Testing Patterns

### 1. Component Testing with Providers
All components are tested with necessary context providers:

```javascript
const renderWithProviders = (darkMode = false) => {
  return render(
    <HelmetProvider>
      <BrowserRouter>
        <DarkModeContext.Provider value={darkMode}>
          <Component />
        </DarkModeContext.Provider>
      </BrowserRouter>
    </HelmetProvider>
  );
};
```

### 2. User Interaction Testing
Uses `@testing-library/user-event` for realistic user interactions:

```javascript
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

### 3. Async Testing
Properly handles asynchronous operations:

```javascript
await waitFor(() => {
  expect(element).toBeInTheDocument();
});
```

### 4. Mocking
Mocks external dependencies and browser APIs:

```javascript
vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => null,
}));
```

## Test Environment

### Setup (`setup.js`)
- Configures jsdom environment
- Mocks browser APIs (matchMedia, IntersectionObserver, ResizeObserver)
- Sets up localStorage mock
- Configures @testing-library/jest-dom matchers
- Automatic cleanup after each test

### Configuration (`vitest.config.js`)
- Uses jsdom environment for DOM testing
- Enables CSS processing
- Configures coverage reporting
- Excludes test files and configs from coverage

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on user-facing functionality
   - Avoid testing internal state directly
   - Use accessible queries (getByRole, getByLabelText)

2. **Isolation**
   - Each test is independent
   - Automatic cleanup after each test
   - Fresh mocks for each test

3. **Meaningful Assertions**
   - Test actual output, not implementation details
   - Verify DOM changes and user-visible results
   - Use appropriate matchers

4. **Comprehensive Coverage**
   - Component rendering
   - User interactions
   - Edge cases
   - Error states
   - Accessibility

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-deployment

### CI Command
```bash
npm run test:run
```

## Debugging Tests

### Run specific test file
```bash
npm test EVChargingCalculator
```

### Run tests matching pattern
```bash
npm test -- -t "calculates charging time"
```

### View UI for debugging
```bash
npm run test:ui
```

### Check coverage
```bash
npm run test:coverage
```
Coverage reports are generated in `coverage/` directory.

## Adding New Tests

1. Create test file next to component: `Component.test.jsx`
2. Import necessary testing utilities
3. Set up proper providers and context
4. Write descriptive test cases
5. Test user interactions and edge cases
6. Verify accessibility
7. Run tests and check coverage

### Example Test Template

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Component from '../Component';

describe('Component', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('renders correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<Component />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(screen.getByText('Updated Text')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Tests failing with "ResizeObserver is not defined"
Already mocked in `setup.js`

### Tests failing with "matchMedia is not defined"
Already mocked in `setup.js`

### Tests timing out
Increase timeout or check for unresolved promises:
```javascript
it('test', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Coverage not generated
Install coverage provider:
```bash
npm install -D @vitest/coverage-v8
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)

## Maintenance

- Review and update tests when components change
- Add tests for new features
- Keep test coverage above thresholds
- Refactor tests to reduce duplication
- Update mocks as dependencies change
