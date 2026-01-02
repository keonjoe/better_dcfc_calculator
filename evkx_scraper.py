import requests
from bs4 import BeautifulSoup
import sqlite3
import time
import re
from urllib.parse import urljoin
import urllib3

# --- SSL FIX ---
# Disable SSL warnings to keep the output clean when verify=False is used
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# ---------------

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
        # verify=False bypasses the SSL error
        response = requests.get(url, headers=HEADERS, timeout=20, verify=False)
        response.raise_for_status()
        return BeautifulSoup(response.content, 'html.parser')
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

def clean_text(text):
    """Cleans whitespace from text."""
    if text:
        return text.replace("Go to ", "").replace(" EV-model overview", "").strip()
        
    return ""

def extract_number(text):
    """Extracts the first floating point number from a string."""
    if not text:
        return None
    # Removes non-numeric characters except dots, then parses
    match = re.search(r"(\d+(\.\d+)?)", text)
    return float(match.group(1)) if match else None

def scrape_makes():
    """Scrapes the list of Make URLs from the main models page."""
    soup = get_soup(BASE_URL)
    if not soup:
        return []
    
    makes = []
    for link in soup.find_all('a', href=True):
        href = link['href']
        # Check for standard make URL patterns
        if '/models/' in href and href.count('/') == 3 and href[:7] == '/models':
            full_url = urljoin(BASE_URL, href)
            make_name = link.text.replace("Go to ", "").replace(" EV-model overview", "").strip()
            
            # Filter out navigational garbage if any
            if full_url not in [m['url'] for m in makes] and make_name:
                makes.append({'name': make_name, 'url': full_url})

    
    return list({v['url']: v for v in makes}.values())[:-1]

def scrape_models(make_url):
    """Scrapes the list of Model URLs from a Make page."""
    soup = get_soup(make_url)
    if not soup:
        return []
    
    models = []
    make = make_url.rstrip("/").split("/")[-1]
    for link in soup.find_all('a', href=True):
        href = link['href']
        if make_url in urljoin(BASE_URL, href) and href.count('/') == 4 and make in href:
            full_url = urljoin(BASE_URL, href)
            model_name = href.rstrip("/").split("/")[-1]
            
            # Ignore "Go to..." buttons
            if "go to" in model_name.lower() or "overview" in model_name.lower():
                continue

            if full_url != make_url and full_url not in [m['url'] for m in models]:
                models.append({'name': model_name, 'url': full_url})
                
    return models

def scrape_variants(model_url):
    """Scrapes the list of Variant URLs from a Model page."""
    soup = get_soup(model_url)
    if not soup:
        return []
    
    variants = []
    links = soup.find_all('a', href=True)
    found_variants = False
    
    for link in links:
        href = link['href']
        full_url = urljoin(BASE_URL, href)
        
        # Check if link is a child of the model URL
        if model_url.rstrip('/') in full_url and len(full_url) > len(model_url):
            # Exclude tabs/sub-sections
            if any(x in full_url for x in ['gallery', 'reviews','range','chargingcurve','specifications']):
                continue
            
            variant_name = full_url.rstrip("/").split("/")[-1]
            # Filter out generic link text
            if variant_name.lower() in ["read more", "details", ""]:
                continue

            if full_url not in [v['url'] for v in variants]:
                variants.append({'name': variant_name, 'url': full_url})
                found_variants = True
                
    return variants

def parse_charging_curve(variant_url, vehicle_id, cursor):
    """Fetches and parses the charging curve table."""
    url = urljoin(variant_url, "chargingcurve/")
    soup = get_soup(url)
    if not soup:
        return

    tables = soup.find_all('table')
    target_table = None
    
    # Find table with SOC and Speed headers
    for table in tables:
        headers = [th.get_text().strip().lower() for th in table.find_all('th')]
        if any('soc' in h for h in headers) and any('speed' in h for h in headers):
            target_table = table
            break
            
    if target_table:
        rows = target_table.find_all('tr')[1:]
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 3:
                # Layout varies, usually SOC | Power | Time | Energy
                soc_txt = cols[0].text
                power_txt = cols[1].text
                time_val = clean_text(cols[2].text)
                energy_txt = cols[3].text if len(cols) > 3 else "0"
                
                soc = extract_number(soc_txt)
                power = extract_number(power_txt)
                energy = extract_number(energy_txt)
                
                if soc is not None and power is not None:
                    cursor.execute('''
                        INSERT INTO charging_curve (vehicle_id, soc_percent, power_kw, time_elapsed, energy_charged_kwh)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (vehicle_id, soc, power, time_val, energy))

def parse_range_data(variant_url, vehicle_id, cursor):
    """Fetches and parses range scenarios from rangeandconsumption page."""
    # Prioritize the 'rangeandconsumption' page as requested
    target_urls = [urljoin(variant_url, "rangeandconsumption/"), urljoin(variant_url, "range/")]
    
    soup = None
    for url in target_urls:
        soup = get_soup(url)
        if soup:
            break
            
    if not soup:
        return

    # Function to extract data from a list of rows
    def process_rows(rows):
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 2:
                scenario = clean_text(cols[0].text)
                range_val = None
                consumption_val = None
                
                # Check columns for range and consumption data
                # Typically cols[1] is Range or Consumption depending on table type
                for col in cols[1:]:
                    text = col.get_text().strip().lower()
                    val = extract_number(text)
                    if val is None:
                        continue
                    
                    # Heuristics to distinguish Range vs Consumption
                    if 'kwh' in text:
                        consumption_val = val
                    elif 'km' in text:
                        range_val = val
                    elif 'mi' in text:
                        pass # Ignore miles, prefer KM (assumed to be present if miles are)
                    else:
                        # If no unit text, guess based on magnitude
                        # Consumption usually < 40, Range usually > 50
                        if val > 45: 
                            if range_val is None: range_val = val
                        else:
                            if consumption_val is None: consumption_val = val

                if range_val:
                     cursor.execute('''
                        INSERT INTO range_scenarios (vehicle_id, scenario_name, range_km, consumption_kwh_100km)
                        VALUES (?, ?, ?, ?)
                    ''', (vehicle_id, scenario, range_val, consumption_val))

    # Targeted approach: Find tables following specific headers
    target_headers = ["official test cycle", "real world range"]
    headers = soup.find_all(['h2', 'h3', 'h4', 'h5'])
    processed_count = 0
    
    for h in headers:
        if any(target in h.get_text().lower() for target in target_headers):
            table = h.find_next('table')
            if table:
                process_rows(table.find_all('tr'))
                processed_count += 1
                
    # Fallback: If no targeted headers found, use generic table scanning
    if processed_count == 0:
        tables = soup.find_all('table')
        for table in tables:
            text_content = table.get_text().lower()
            if 'km/h' in text_content or 'wltp' in text_content or 'epa' in text_content:
                process_rows(table.find_all('tr'))

def scrape_variant_details(variant_url, make, model, variant_name, cursor, conn):
    """Main function to process a specific variant."""
    print(f"Processing: {make} {model} - {variant_name}")
    soup = get_soup(variant_url)
    if not soup:
        return

    text = soup.get_text()
    
    # 1. Basic Specs
    battery_gross = None
    battery_net = None
    wltp_range = None
    
    # Regex extraction
    gross_match = re.search(r'(?:Gross capacity|Gross battery).*?([\d\.]+)\s*kWh', text, re.IGNORECASE)
    if gross_match: battery_gross = float(gross_match.group(1))
        
    net_match = re.search(r'(?:Net capacity|Usable capacity|Net battery).*?([\d\.]+)\s*kWh', text, re.IGNORECASE)
    if net_match: battery_net = float(net_match.group(1))
        
    wltp_match = re.search(r'WLTP.*?range.*?([\d]+)\s*km', text, re.IGNORECASE)
    if wltp_match: wltp_range = float(wltp_match.group(1))

    # Insert Vehicle
    cursor.execute('''
        INSERT OR IGNORE INTO vehicles (make, model, variant, variant_url, battery_gross_kwh, battery_net_kwh, wltp_range_km)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (make, model, variant_name, variant_url, battery_gross, battery_net, wltp_range))
    
    vehicle_id = cursor.lastrowid
    if vehicle_id == 0:
        cursor.execute('SELECT id FROM vehicles WHERE variant_url = ?', (variant_url,))
        res = cursor.fetchone()
        if res: vehicle_id = res[0]
        else: return

    # 2. Details
    parse_charging_curve(variant_url, vehicle_id, cursor)
    parse_range_data(variant_url, vehicle_id, cursor)

    conn.commit()

def main():
    conn = setup_database()
    cursor = conn.cursor()
    
    print("Starting scrape of EVKX.net (SSL Verification Disabled)...")
    
    makes = scrape_makes()
    print(f"Found {len(makes)} makes.")
    
    for make in makes:
        print(f"Scraping Make: {make['name']}")
        models = scrape_models(make['url'])
        
        for model in models:
            variants = scrape_variants(model['url'])
            
            if not variants:
                # Sometimes the model page IS the variant page
                scrape_variant_details(model['url'], make['name'], model['name'], model['name'], cursor, conn)
            else:
                for variant in variants:
                    scrape_variant_details(variant['url'], make['name'], model['name'], variant['name'], cursor, conn)
        
    conn.close()
    print("Scraping complete. Data saved to ev_data.db")

if __name__ == "__main__":
    main()