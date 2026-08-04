import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { resolve } from 'path';
import initSqlJs from 'sql.js';
import EVChargingCalculator from '../EVChargingCalculator';
import { DarkModeContext } from '../App';
import { DC_CONNECTOR_CURRENT_CEILING_A } from '../batteryModel';

// These tests run the component against the real vehicle database rather than
// the stubbed sql.js in setup.js, so the voltage / current estimation and the
// leaderboard actually see production data.
beforeAll(async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  });
  window.initSqlJs = vi.fn(() => Promise.resolve(SQL));
});

const renderWithProviders = () => render(
  <HelmetProvider>
    <BrowserRouter>
      <DarkModeContext.Provider value={{ darkMode: false }}>
        <EVChargingCalculator />
      </DarkModeContext.Provider>
    </BrowserRouter>
  </HelmetProvider>
);

const waitForVehicle = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/Loading Database/i)).not.toBeInTheDocument();
  }, { timeout: 20000 });
  await waitFor(() => {
    expect(screen.getByText(/Estimated Pack Voltage/i)).toBeInTheDocument();
  }, { timeout: 20000 });
};

// The app picks a random vehicle on load, so pin one that is known to carry
// pack voltage data (Acura ZDX: 96s3p, 355.2 V nominal, NCMA).
const selectVehicle = async (user, make, model) => {
  const [makeSelect] = screen.getAllByRole('combobox');
  await user.selectOptions(makeSelect, make);
  await waitFor(() => {
    expect(screen.getAllByRole('combobox')[1].querySelectorAll('option').length).toBeGreaterThan(1);
  });

  const modelSelect = screen.getAllByRole('combobox')[1];
  await user.selectOptions(modelSelect, model);
  await waitFor(() => {
    expect(screen.getAllByRole('combobox')[2].querySelectorAll('option').length).toBeGreaterThan(1);
  });

  const variantSelect = screen.getAllByRole('combobox')[2];
  const firstVariant = [...variantSelect.querySelectorAll('option')].find(o => o.value !== '');
  await user.selectOptions(variantSelect, firstVariant.value);

  await waitFor(() => {
    expect(screen.queryByText(/no pack voltage or cell configuration data/i)).not.toBeInTheDocument();
  });
};

const selectKnownVehicle = (user) => selectVehicle(user, 'Acura', 'zdx');

// The stat card label is a span; the chart axis toggle is a button with the
// same text, so scope the query to spans.
const statCard = (label) => screen.getByText(label, { selector: 'span' }).closest('div.bg-white');

// Loading the 6 MB database is expensive, so the calculator side is covered by
// a single render that walks through voltage, current limiting and the axes.
describe('EVChargingCalculator with the real database', () => {
  it('estimates voltage and current, applies a current limit, and plots against time', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await waitForVehicle();
    await selectKnownVehicle(user);

    expect(statCard('Peak Current')).not.toBeNull();
    expect(statCard('Pack Voltage')).not.toBeNull();

    // Peak current should be a real number in a sane range for a DC session.
    const amps = within(statCard('Peak Current')).getByText(/^\d+$/);
    expect(Number(amps.textContent)).toBeGreaterThan(0);
    expect(Number(amps.textContent)).toBeLessThan(2000);

    // A very low current limit must slow the session down.
    const before = statCard('Time').textContent;
    await user.click(screen.getByLabelText(/limit by current/i));
    const initialInput = screen.getByLabelText('Initial Current');
    fireEvent.change(initialInput, { target: { value: '30' } });
    fireEvent.blur(initialInput);

    await waitFor(() => {
      expect(statCard('Time').textContent).not.toBe(before);
    });

    // Time axis labels on the chart look like "12m 30s"
    await user.click(screen.getByRole('button', { name: /^time$/i }));
    await waitFor(() => {
      const chart = document.querySelector('svg[viewBox="0 0 600 300"]');
      expect(chart).not.toBeNull();
      expect(chart.textContent).toMatch(/\d+m \d\ds/);
    });
  }, 60000);

  it('breaks the session time into actual, ideal and the loss from limits', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await waitForVehicle();
    await selectKnownVehicle(user);

    const card = statCard('Time');
    expect(within(card).getByText('actual')).toBeInTheDocument();
    expect(within(card).getByText('Ideal')).toBeInTheDocument();
    expect(within(card).getByText(/Lost to limits/i)).toBeInTheDocument();

    // Drop the station power right down: the ideal time is unchanged but the
    // actual time and the loss both grow.
    const readMinutes = (label) => {
      const row = [...card.querySelectorAll('div')].find(d => d.firstChild?.textContent === label);
      const match = row.textContent.match(/(\d+)m\s*(\d+)s/);
      return Number(match[1]) + Number(match[2]) / 60;
    };
    const idealBefore = readMinutes('Ideal');

    const powerSlider = [...document.querySelectorAll('input[type="range"]')]
      .find(el => el.max === '600' && el.min === '20');
    fireEvent.change(powerSlider, { target: { value: '20' } });

    await waitFor(() => {
      expect(within(statCard('Time')).queryByText('none')).not.toBeInTheDocument();
    });

    const after = statCard('Time');
    const lostRow = [...after.querySelectorAll('div')].find(d => d.firstChild?.textContent === 'Lost to limits');
    expect(lostRow.textContent).toMatch(/\+\d+m/);
    // Ideal is a property of the vehicle, so throttling the station cannot move it
    const idealAfter = (() => {
      const row = [...after.querySelectorAll('div')].find(d => d.firstChild?.textContent === 'Ideal');
      const match = row.textContent.match(/(\d+)m\s*(\d+)s/);
      return Number(match[1]) + Number(match[2]) / 60;
    })();
    expect(idealAfter).toBeCloseTo(idealBefore, 2);
  }, 60000);

  it('models the GM Ultium pack as reconfiguring to 800 V for DC charging', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await waitForVehicle();
    // Every Escalade IQ row is recorded as 96s6p at 355 V, which would need
    // close to 1000 A to hit its charging curve. (Some Silverado trims are
    // already recorded in the reconfigured 192s3p / 650 V form.)
    await selectVehicle(user, 'Cadillac', 'escalade');

    await waitFor(() => {
      expect(screen.getByText(/switch(es)? its halves into series/i)).toBeInTheDocument();
    });

    const amps = Number(within(statCard('Peak Current')).getByText(/^\d+$/).textContent);
    expect(amps).toBeGreaterThan(300);
    expect(amps).toBeLessThan(DC_CONNECTOR_CURRENT_CEILING_A);

    // Nominal pack voltage should read as an 800 V class pack, not 355 V.
    const volts = within(statCard('Pack Voltage')).getByText(/^\d+ V$/);
    expect(Number(volts.textContent.replace(' V', ''))).toBeGreaterThan(600);
  }, 60000);

  it('plots charging current when the y axis is switched to current', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await waitForVehicle();
    await selectKnownVehicle(user);

    const currentButton = screen.getByRole('button', { name: /^current$/i });
    expect(currentButton).not.toBeDisabled();
    await user.click(currentButton);

    await waitFor(() => {
      const chart = document.querySelector('svg[viewBox="0 0 600 300"]');
      // Y axis unit label flips from kW to A
      expect([...chart.querySelectorAll('text')].some(t => t.textContent === 'A')).toBe(true);
    });
  }, 60000);

  it('calculates the highest charging current leaderboard', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await waitForVehicle();

    await user.click(screen.getByRole('button', { name: /leaderboards/i }));

    const metricSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(metricSelect, 'highest-charging-current');

    // Narrow the battery capacity filter so the run stays quick. The two
    // battery sliders are the only ones whose max sits in the 150-500 range.
    const batterySliders = [...document.querySelectorAll('input[type="range"]')]
      .filter(el => Number(el.max) > 150 && Number(el.max) < 500);
    expect(batterySliders.length).toBe(2);
    fireEvent.change(batterySliders[0], { target: { value: '150' } });

    await user.click(screen.getByRole('button', { name: /calculate leaderboard/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Calculating leaderboard/i)).not.toBeInTheDocument();
    }, { timeout: 30000 });

    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);

    // Peak current column should be descending and every row should have one.
    const currents = [...rows].map(row => {
      const cell = row.querySelectorAll('td')[3];
      return Number(cell.textContent.replace(/[^\d.].*$/, ''));
    });
    currents.forEach(a => expect(Number.isFinite(a)).toBe(true));
    for (let i = 1; i < currents.length; i++) {
      expect(currents[i]).toBeLessThanOrEqual(currents[i - 1]);
    }
  }, 60000);
});
