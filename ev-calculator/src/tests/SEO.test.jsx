import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import SEO from '../SEO';

// Helper to render SEO with HelmetProvider
const renderSEO = (props = {}) => {
  const helmetContext = {};
  return render(
    <HelmetProvider context={helmetContext}>
      <SEO {...props} />
    </HelmetProvider>
  );
};

describe('SEO Component', () => {
  beforeEach(() => {
    // Clear document head before each test
    document.head.innerHTML = '';
  });

  it('renders with default props', () => {
    const { container } = renderSEO();
    expect(container).toBeDefined();
  });

  it('sets the page title', async () => {
    renderSEO({ title: 'Test Title' });
    await waitFor(() => {
      const helmet = document.querySelector('title');
      expect(helmet?.textContent).toBe('Test Title');
    });
  });

  it('sets meta description', async () => {
    renderSEO({ description: 'Test Description' });
    await waitFor(() => {
      const meta = document.querySelector('meta[name="description"]');
      expect(meta?.getAttribute('content')).toBe('Test Description');
    });
  });

  it('sets meta keywords', async () => {
    renderSEO({ keywords: 'test, keywords' });
    await waitFor(() => {
      const meta = document.querySelector('meta[name="keywords"]');
      expect(meta?.getAttribute('content')).toBe('test, keywords');
    });
  });

  it('sets Open Graph meta tags', async () => {
    const props = {
      title: 'OG Title',
      description: 'OG Description',
      url: 'https://example.com',
      image: 'https://example.com/image.png',
      type: 'website'
    };
    renderSEO(props);

    await waitFor(() => {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      const ogDescription = document.querySelector('meta[property="og:description"]');
      const ogUrl = document.querySelector('meta[property="og:url"]');
      const ogImage = document.querySelector('meta[property="og:image"]');
      const ogType = document.querySelector('meta[property="og:type"]');

      expect(ogTitle?.getAttribute('content')).toBe('OG Title');
      expect(ogDescription?.getAttribute('content')).toBe('OG Description');
      expect(ogUrl?.getAttribute('content')).toBe('https://example.com');
      expect(ogImage?.getAttribute('content')).toBe('https://example.com/image.png');
      expect(ogType?.getAttribute('content')).toBe('website');
    });
  });

  it('sets Twitter Card meta tags', async () => {
    const props = {
      title: 'Twitter Title',
      description: 'Twitter Description',
      url: 'https://example.com',
      image: 'https://example.com/twitter-image.png'
    };
    renderSEO(props);

    await waitFor(() => {
      const twitterCard = document.querySelector('meta[property="twitter:card"]');
      const twitterTitle = document.querySelector('meta[property="twitter:title"]');
      const twitterDescription = document.querySelector('meta[property="twitter:description"]');
      const twitterImage = document.querySelector('meta[property="twitter:image"]');
      const twitterUrl = document.querySelector('meta[property="twitter:url"]');

      expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');
      expect(twitterTitle?.getAttribute('content')).toBe('Twitter Title');
      expect(twitterDescription?.getAttribute('content')).toBe('Twitter Description');
      expect(twitterImage?.getAttribute('content')).toBe('https://example.com/twitter-image.png');
      expect(twitterUrl?.getAttribute('content')).toBe('https://example.com');
    });
  });

  it('sets canonical URL', async () => {
    renderSEO({ url: 'https://canonical.example.com' });
    await waitFor(() => {
      const canonical = document.querySelector('link[rel="canonical"]');
      expect(canonical?.getAttribute('href')).toBe('https://canonical.example.com');
    });
  });

  it('uses default values when no props provided', async () => {
    renderSEO();
    await waitFor(() => {
      const title = document.querySelector('title');
      expect(title?.textContent || '').toContain('EV Charging Calculator');
    });
  });
});
