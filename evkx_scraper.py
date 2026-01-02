# -*- coding: utf-8 -*-
"""
Created on Fri Jan  2 16:17:17 2026

@author: qiyuan.zhou
"""

import requests
from bs4 import BeautifulSoup
import sqlite3
import time
import re
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://evkx.net/models/"
DB_NAME = "ev_data.db"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def setup_database():
    """Creates the SQLite database and necessary tables."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Table for Vehicle Variants
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            make TEXT,
            model TEXT,
            variant TEXT,
            variant_url TEXT UNIQUE,
            battery_gross_kwh REAL,
            battery_net_kwh REAL,
            wltp_range_km REAL
        )
    ''')
    
    # Table for Charging Curve Data
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS charging_curve (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER,
            soc_percent INTEGER,
            power_kw REAL,
            time_elapsed TEXT,
            energy_charged_kwh REAL,
            FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
        )
    ''')
    
    # Table for Range Scenarios (e.g., Highway, City)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS range_scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER,
            scenario_name TEXT,
            range_km REAL,
            consumption_kwh_100km REAL,
            FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
        )
    ''')
    
    conn.commit()
    return conn

def get_soup(url):
    """Fetches a URL and returns a BeautifulSoup object."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return BeautifulSoup(response.content, 'html.parser')
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

def clean_text(text):
    """Cleans whitespace from text."""
    if text:
        return text.strip()
    return ""

def extract_number(text):
    """Extracts the first floating point number from a string."""
    if not text:
        return None
    match = re.search(r"(\d+(\.\d+)?)", text)
    return float(match.group(1)) if match else None

def scrape_makes():
    """Scrapes the list of Make URLs from the main models page."""
    soup = get_soup(BASE_URL)
    if not soup:
        return []
    
    makes = []
    # Identify links to brand pages (heuristic based on page structure)
    # Looking for links that likely point to /models/{brand}/
    # Adjust selector based on actual site structure
    for link in soup.find_all('a', href=True):
        href = link['href']
        if '/models/' in href and href.count('/') == 4: # e.g., https://evkx.net/models/audi/
            full_url = urljoin(BASE_URL, href)
            make_name = clean_text(link.text)
            if full_url not in [m['url'] for m in makes] and make_name:
                makes.append({'name': make_name, 'url': full_url})
    
    # De-duplicate based on URL
    unique_makes = {v['url']: v for v in makes}.values()
    return list(unique_makes)

def scrape_models(make_url):
    """Scrapes the list of Model URLs from a Make page."""
    soup = get_soup(make_url)
    if not soup:
        return []
    
    models = []
    # Similar logic: find links to model pages
    for link in soup.find_all('a', href=True):
        href = link['href']
        # e.g., /models/audi/q4_e-tron/
        if make_url in urljoin(BASE_URL, href) and href.count('/') >= 5:
            full_url = urljoin(BASE_URL, href)
            model_name = clean_text(link.text)
            if "model info" in model_name.lower() or "go to" in model_name.lower():
                continue # Skip navigation links if they are just buttons
            
            # Often the link text is the model name
            if full_url != make_url and full_url not in [m['url'] for m in models]:
                models.append({'name': model_name, 'url': full_url})
                
    return models

def scrape_variants(model_url):
    """Scrapes the list of Variant URLs from a Model page."""
    soup = get_soup(model_url)
    if not soup:
        return []
    
    variants = []
    # Check if this page lists variants or IS the variant page (single variant models)
    # Heuristic: Look for links that extend the current URL
    
    links = soup.find_all('a', href=True)
    found_variants = False
    
    for link in links:
        href = link['href']
        full_url = urljoin(BASE_URL, href)
        
        # If the link is a sub-path of the model URL, it's likely a variant
        if model_url.rstrip('/') in full_url and len(full_url) > len(model_url):
            # Exclude standard sub-pages like gallery, reviews, etc.
            if any(x in full_url for x in ['gallery', 'reviews', 'specifications', 'chargingcurve', 'range']):
                continue
            
            variant_name = clean_text(link.text)
            if variant_name and full_url not in [v['url'] for v in variants]:
                variants.append({'name': variant_name, 'url': full_url})
                found_variants = True
                
    # If no sub-variants found, the model URL might be the only variant
    if not found_variants:
        # We assume the model name is the variant name
        # Need to re-fetch or pass model name down
        pass # Logic handled in main loop if list is empty
        
    return variants

def parse_charging_curve(variant_url, vehicle_id, cursor):
    """Fetches and parses the charging curve table."""
    url = urljoin(variant_url, "chargingcurve/")
    soup = get_soup(url)
    if not soup:
        return

    # Find the table with charging data
    # Heuristic: Table containing "SOC" and "kW"
    tables = soup.find_all('table')
    target_table = None
    
    for table in tables:
        headers = [th.get_text().strip().lower() for th in table.find_all('th')]
        if 'soc' in headers and 'speed' in headers:
            target_table = table
            break
            
    if target_table:
        rows = target_table.find_all('tr')[1:] # Skip header
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 4:
                soc = extract_number(cols[0].text)
                power = extract_number(cols[1].text)
                time_val = clean_text(cols[2].text)
                energy = extract_number(cols[3].text)
                
                if soc is not None and power is not None:
                    cursor.execute('''
                        INSERT INTO charging_curve (vehicle_id, soc_percent, power_kw, time_elapsed, energy_charged_kwh)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (vehicle_id, soc, power, time_val, energy))

def parse_range_data(variant_url, vehicle_id, cursor):
    """Fetches and parses range scenarios."""
    # Try the 'range' sub-page
    url = urljoin(variant_url, "range/")
    soup = get_soup(url)
    
    if not soup:
        # Fallback: check the main page or 'rangeandconsumption' if exists
        return

    # Look for tables defining scenarios (City, Highway, etc.)
    # This is highly specific to the site layout; heuristic used here
    tables = soup.find_all('table')
    for table in tables:
        text_content = table.get_text().lower()
        if 'km/h' in text_content or 'city' in text_content or 'highway' in text_content:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:
                    scenario = clean_text(cols[0].text)
                    val_text = clean_text(cols[1].text)
                    
                    # Heuristic to separate range from consumption if in same cell or adjacent
                    range_val = extract_number(val_text)
                    
                    if range_val and range_val > 50: # Simple filter to avoid consumption figures (usually < 30 kWh)
                         cursor.execute('''
                            INSERT INTO range_scenarios (vehicle_id, scenario_name, range_km)
                            VALUES (?, ?, ?)
                        ''', (vehicle_id, scenario, range_val))

def scrape_variant_details(variant_url, make, model, variant_name, cursor, conn):
    """Main function to process a specific variant."""
    print(f"Processing: {make} {model} - {variant_name}")
    soup = get_soup(variant_url)
    if not soup:
        return

    # 1. Extract Basic Specs (Battery, WLTP) from Main Page
    battery_gross = None
    battery_net = None
    wltp_range = None
    
    # Search for "Specifications" section or Data Blocks
    # Using regex to find text patterns in the page content
    text = soup.get_text()
    
    # Battery
    gross_match = re.search(r'Gross capacity[:\s]+([\d\.]+) kWh', text, re.IGNORECASE)
    if gross_match:
        battery_gross = float(gross_match.group(1))
        
    net_match = re.search(r'Net capacity[:\s]+([\d\.]+) kWh', text, re.IGNORECASE) # Or "usable capacity"
    if not net_match:
        net_match = re.search(r'usable capacity[:\s]+([\d\.]+) kWh', text, re.IGNORECASE)
    if net_match:
        battery_net = float(net_match.group(1))
        
    # WLTP Range
    wltp_match = re.search(r'WLTP range.*?([\d]+)\s*km', text, re.IGNORECASE)
    if wltp_match:
        wltp_range = float(wltp_match.group(1))

    # Insert Vehicle Record
    cursor.execute('''
        INSERT OR IGNORE INTO vehicles (make, model, variant, variant_url, battery_gross_kwh, battery_net_kwh, wltp_range_km)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (make, model, variant_name, variant_url, battery_gross, battery_net, wltp_range))
    
    vehicle_id = cursor.lastrowid
    
    # If vehicle already existed (ignore), fetch its ID
    if vehicle_id == 0: 
        cursor.execute('SELECT id FROM vehicles WHERE variant_url = ?', (variant_url,))
        result = cursor.fetchone()
        if result:
            vehicle_id = result[0]
        else:
            return

    # 2. Extract Charging Curve
    parse_charging_curve(variant_url, vehicle_id, cursor)
    
    # 3. Extract Range Scenarios
    parse_range_data(variant_url, vehicle_id, cursor)

    conn.commit()
    time.sleep(1) # Be polite

def main():
    conn = setup_database()
    cursor = conn.cursor()
    
    print("Starting scrape of EVKX.net...")
    
    makes = scrape_makes()
    print(f"Found {len(makes)} makes.")
    
    for make in makes:
        print(f"Scraping Make: {make['name']}")
        models = scrape_models(make['url'])
        
        for model in models:
            variants = scrape_variants(model['url'])
            
            # If no variants found, treat the model page as the variant
            if not variants:
                 scrape_variant_details(model['url'], make['name'], model['name'], model['name'], cursor, conn)
            else:
                for variant in variants:
                    scrape_variant_details(variant['url'], make['name'], model['name'], variant['name'], cursor, conn)
        
    conn.close()
    print("Scraping complete. Data saved to ev_data.db")

if __name__ == "__main__":
    main()