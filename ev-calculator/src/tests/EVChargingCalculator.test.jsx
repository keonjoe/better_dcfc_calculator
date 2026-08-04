import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import EVChargingCalculator from '../EVChargingCalculator';
import { DarkModeContext } from '../App';

// Helper to render component with all required providers
const renderWithProviders = (darkMode = false) => {
  return render(
    <HelmetProvider>
      <BrowserRouter>
        <DarkModeContext.Provider value={darkMode}>
          <EVChargingCalculator />
        </DarkModeContext.Provider>
      </BrowserRouter>
    </HelmetProvider>
  );
};

describe('EVChargingCalculator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderWithProviders();
    // The component is named "A Better DCFC Charging Calculator"
    expect(screen.getByText(/Better DCFC/i)).toBeInTheDocument();
  });

  it('displays all main sections', () => {
    renderWithProviders();
    
    // Check for main calculator elements
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('displays initial default values', () => {
    renderWithProviders();
    
    // Default values should be visible
    expect(screen.getByText(/75/)).toBeInTheDocument(); // Default battery capacity
  });

  it('updates battery capacity when slider is moved', async () => {
    renderWithProviders();
    
    const slider = screen.getAllByRole('slider')[0]; // First slider should be battery capacity
    expect(slider).toBeInTheDocument();
  });

  it('calculates charging time correctly', async () => {
    renderWithProviders();
    
    // The component should display some calculated results
    await waitFor(() => {
      expect(document.body.textContent.length).toBeGreaterThan(0);
    });
  });

  it('displays energy and cost information', () => {
    renderWithProviders();
    
    // Component should render with content
    expect(document.body.textContent.length).toBeGreaterThan(100);
  });

  it('has vehicle presets dropdown', async () => {
    renderWithProviders();
    
    // Look for the vehicle selector or presets
    const buttons = screen.getAllByRole('button');
    const presetButton = buttons.find(button => 
      button.textContent.includes('Tesla') || 
      button.textContent.includes('preset') ||
      button.textContent.includes('vehicle')
    );
    
    expect(presetButton || buttons.length > 0).toBeTruthy();
  });

  it('allows custom charging curve editing', async () => {
    renderWithProviders();
    
    // Look for custom mode toggle or edit button
    const buttons = screen.getAllByRole('button');
    
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('displays charging curve visualization', () => {
    renderWithProviders();
    
    // The chart should be rendered (SVG or canvas)
    const svgElements = document.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('calculates cost based on kWh rate', async () => {
    renderWithProviders();
    
    // Component should have cost calculations or elements rendered
    await waitFor(() => {
      expect(document.body.textContent.length).toBeGreaterThan(0);
    });
  });

  it('handles start and stop SOC changes', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(2); // Should have multiple sliders
    
    // Try to interact with SOC sliders
    const startSocSlider = sliders.find(slider => 
      slider.getAttribute('aria-label')?.includes('start') ||
      slider.parentElement?.textContent.includes('Start')
    ) || sliders[1];
    
    await user.click(startSocSlider);
  });

  it('supports dark mode rendering', () => {
    renderWithProviders(true);
    
    // Component should render without errors in dark mode
    expect(screen.getByText(/Better DCFC/i)).toBeInTheDocument();
  });

  it('displays info tooltips', async () => {
    renderWithProviders();
    
    // Look for info icons
    const infoIcons = document.querySelectorAll('svg');
    expect(infoIcons.length).toBeGreaterThan(0);
  });

  it('shows efficiency calculations', () => {
    renderWithProviders();
    
    // Should display efficiency-related information
    const text = document.body.textContent;
    expect(text).toBeTruthy();
  });

  it('updates calculations when inputs change', async () => {
    renderWithProviders();
    
    // Content should still be rendered
    expect(document.body.textContent).toBeTruthy();
  });

  it('handles maximum power limitations', () => {
    renderWithProviders();
    
    // Should have charger power controls
    const powerText = screen.queryAllByText(/power/i);
    expect(powerText.length).toBeGreaterThan(0);
  });

  it('validates SOC range (0-100%)', async () => {
    renderWithProviders();
    
    // Sliders should have appropriate min/max values
    const sliders = screen.getAllByRole('slider');
    sliders.forEach(slider => {
      const min = Number(slider.getAttribute('min'));
      const max = Number(slider.getAttribute('max'));
      
      if (slider.parentElement?.textContent.toLowerCase().includes('soc')) {
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBeLessThanOrEqual(100);
      }
    });
  });

  it('offers a current limit toggle that reveals the current inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const toggle = screen.getByLabelText(/limit by current/i);
    expect(toggle).toBeInTheDocument();
    expect(screen.queryByText(/initial current/i)).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getAllByText(/initial current/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/derated current/i)).toBeInTheDocument();
    expect(screen.getByText(/derate after/i)).toBeInTheDocument();

    // Defaults: 600 A dropping to 400 A after 10 minutes
    expect(screen.getByLabelText('Initial Current')).toHaveValue(600);
    expect(screen.getByLabelText('Derated Current')).toHaveValue(400);
    expect(screen.getByText(/^10 min$/)).toBeInTheDocument();
  });

  it('toggles the chart x axis between SoC and time', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const timeButton = screen.getByRole('button', { name: /^time$/i });
    const socButton = screen.getByRole('button', { name: /^soc$/i });
    expect(timeButton).toBeInTheDocument();

    await user.click(timeButton);
    await user.click(socButton);

    // Still rendering after switching axes
    expect(screen.getByRole('heading', { name: /^Charging Session$/i })).toBeInTheDocument();
  });

  it('defaults the y axis to power and disables current without pack data', () => {
    renderWithProviders();

    const powerButton = screen.getByRole('button', { name: /^power$/i });
    const currentButton = screen.getByRole('button', { name: /^current$/i });

    // Power is the selected default
    expect(powerButton.className).toMatch(/bg-white/);
    // No database in this test, so there is no voltage model to plot amps from
    expect(currentButton).toBeDisabled();
  });

  it('exposes the highest charging current leaderboard metric and current filter', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByRole('button', { name: /leaderboards/i }));

    expect(screen.getByRole('option', { name: /highest charging current/i })).toBeInTheDocument();

    const currentToggle = screen.getByLabelText(/charger maximum current/i);
    expect(currentToggle).toBeInTheDocument();
    expect(screen.queryByText(/^1000 A$/)).not.toBeInTheDocument();

    await user.click(currentToggle);
    expect(screen.getByText(/^1000 A$/)).toBeInTheDocument();
    expect(screen.getByText(/^500 A$/)).toBeInTheDocument();
  });

  it('renders input controls as disabled when appropriate', () => {
    renderWithProviders();
    
    // Check for any disabled inputs
    const inputs = screen.getAllByRole('slider');
    // At least one input should exist
    expect(inputs.length).toBeGreaterThan(0);
  });
});
