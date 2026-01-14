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
            country TEXT,
            battery_gross_kwh REAL,
            battery_net_kwh REAL,
            wltp_range_km REAL,
            -- Performance
            peak_power_kw REAL,
            peak_power_boost_kw REAL,
            torque_nm REAL,
            torque_boost_nm REAL,
            top_speed_kph REAL,
            acceleration_0_100_s REAL,
            acceleration_0_100_boost_s REAL,
            -- Range & Consumption
            wltp_basic_range_km REAL,
            wltp_basic_consumption_kwh_100km REAL,
            wltp_basic_consumption_with_loss_kwh_100km REAL,
            wltp_top_range_km REAL,
            wltp_top_consumption_kwh_100km REAL,
            wltp_top_consumption_with_loss_kwh_100km REAL,
            -- Battery & Charging
            max_dc_charging_kw REAL,
            num_modules INTEGER,
            pack_configuration TEXT,
            nominal_voltage_v REAL,
            cathode_material TEXT,
            -- Charge Port
            chargeport_location TEXT,
            chargeport_type_eu TEXT,
            chargeport_type_na TEXT,
            chargeport_type_china TEXT,
            chargeport_type_japan TEXT,
            chargeport_type_oceania TEXT,
            -- Dimensions
            length_mm REAL,
            height_mm REAL,
            width_mm REAL,
            width_with_mirrors_mm REAL,
            wheelbase_mm REAL,
            track_width_front_mm REAL,
            track_width_rear_mm REAL,
            drag_coefficient REAL,
            frontal_area_m2 REAL,
            approach_angle_deg REAL,
            departure_angle_deg REAL,
            turning_circle_m REAL,
            ground_clearance_max_mm REAL,
            ground_clearance_min_mm REAL,
            -- Cargo & Towing
            curb_weight_kg REAL,
            max_weight_kg REAL,
            max_payload_kg REAL,
            max_roof_load_kg REAL,
            trunk_capacity_l REAL,
            trunk_capacity_seats_down_l REAL,
            frunk_capacity_l REAL,
            max_trailer_weight_braked_kg REAL,
            max_trailer_weight_unbraked_kg REAL,
            max_towball_weight_kg REAL
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
            # Extract make name from URL instead of link text to avoid formatting issues
            make_name = href.rstrip("/").split("/")[-1]
            
            # Filter out navigational garbage if any
            if full_url not in [m['url'] for m in makes] and make_name:
                makes.append({'name': make_name, 'url': full_url, 'country': None})

    # Extract country information and proper capitalization from flag images on each make page
    for make in makes:
        make_soup = get_soup(make['url'])
        if make_soup:
            # Look for the proper capitalized make name in the h1 heading
            h1 = make_soup.find('h1')
            if h1:
                # Get only the direct text content, not nested elements
                h1_text = ''.join(h1.find_all(string=True, recursive=False)).strip()
                # If no direct text, try getting text and clean it more aggressively
                if not h1_text:
                    h1_text = ' '.join(h1.get_text().split())
                # Remove common suffixes to get just the make name
                clean_name = h1_text.replace(' models', '').replace(' Models', '').replace(' EV', '').strip()
                if clean_name:
                    make['name'] = clean_name
            
            # Look for country flag image (typically has title attribute with country name)
            flag_img = make_soup.find('img', {'class': lambda x: x and 'flag' in x.lower() if x else False})
            if not flag_img:
                # Alternative: look for any img with title in common locations
                flag_img = make_soup.find('img', title=True)
            
            if flag_img and flag_img.get('title'):
                make['country'] = flag_img.get('title').strip().upper()
    
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
            # Exclude tabs/sub-sections (but not variant names containing these words)
            # Check if these are actual sub-pages (ending with these paths)
            url_parts = full_url.rstrip('/').split('/')
            if len(url_parts) > 5 and url_parts[-1] in ['gallery', 'reviews', 'rangeandconsumption', 'range', 'chargingcurve', 'specifications']:
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
    
    # Find table with SOC and Speed headers (complete charging curve data)
    # Look for the table with most rows containing detailed charging data
    for table in tables:
        headers = [th.get_text().strip().lower() for th in table.find_all('th')]
        # Check if this is the detailed charging curve table
        if any('soc' in h for h in headers) and any('speed' in h for h in headers):
            # Verify it's the detailed table (should have many rows, not summary)
            rows = table.find_all('tr')
            # The complete table has 100+ rows (0-100% SOC)
            if len(rows) > 50:  # More than 50 rows means it's the detailed table
                target_table = table
                break
    
    # Fallback: if no large table found, use any table with SOC/Speed headers
    if not target_table:
        for table in tables:
            headers = [th.get_text().strip().lower() for th in table.find_all('th')]
            if any('soc' in h for h in headers) and any('speed' in h for h in headers):
                target_table = table
                break
            
    if target_table:
        rows = target_table.find_all('tr')[1:]  # Skip header row
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 4:  # Need at least SOC, Speed, Time, Energy columns
                # Column layout: SOC | Speed | Time | Energy charged
                soc_txt = cols[0].get_text().strip()
                power_txt = cols[1].get_text().strip()
                time_txt = cols[2].get_text().strip()
                energy_txt = cols[3].get_text().strip()
                
                soc = extract_number(soc_txt)
                power = extract_number(power_txt)
                energy = extract_number(energy_txt)
                
                if soc is not None and power is not None:
                    cursor.execute('''
                        INSERT INTO charging_curve (vehicle_id, soc_percent, power_kw, time_elapsed, energy_charged_kwh)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (vehicle_id, soc, power, time_txt, energy))

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
                    elif 'km' in text and 'mi' in text:
                        # Both units present (e.g., "272 mi (438 km)")
                        # Extract the km value which is typically in parentheses
                        km_match = re.search(r'\((\d+)\s*km\)', text)
                        if km_match:
                            range_val = float(km_match.group(1))
                        else:
                            # Fallback: just use first number if it's after 'km'
                            range_val = val
                    elif 'km' in text:
                        range_val = val
                    elif 'mi' in text:
                        # Only miles present, convert to km (1 mi = 1.60934 km)
                        range_val = val * 1.60934
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

def scrape_variant_details(variant_url, make, model, variant_name, country, cursor, conn):
    """Main function to process a specific variant."""
    print(f"Processing: {make} {model} - {variant_name}")
    
    # Get specifications page
    specs_url = urljoin(variant_url, "specifications/")
    soup = get_soup(specs_url)
    if not soup:
        return

    text = soup.get_text()
    
    # Initialize all spec variables
    specs = {
        'battery_gross': None, 'battery_net': None, 'wltp_range': None,
        'peak_power': None, 'peak_power_boost': None, 'torque': None, 'torque_boost': None,
        'top_speed': None, 'accel_0_100': None, 'accel_0_100_boost': None,
        'wltp_basic_range': None, 'wltp_basic_consumption': None, 'wltp_basic_consumption_loss': None,
        'wltp_top_range': None, 'wltp_top_consumption': None, 'wltp_top_consumption_loss': None,
        'max_dc_charging': None, 'num_modules': None, 'pack_config': None, 'nominal_voltage': None, 'cathode': None,
        'chargeport_location': None, 'chargeport_eu': None, 'chargeport_na': None, 'chargeport_china': None, 'chargeport_japan': None, 'chargeport_oceania': None,
        'length': None, 'height': None, 'width': None, 'width_mirrors': None, 'wheelbase': None,
        'track_front': None, 'track_rear': None, 'drag_coef': None, 'frontal_area': None,
        'approach_angle': None, 'departure_angle': None, 'turning_circle': None,
        'ground_clearance_max': None, 'ground_clearance_min': None,
        'curb_weight': None, 'max_weight': None, 'max_payload': None, 'max_roof_load': None,
        'trunk': None, 'trunk_seats_down': None, 'frunk': None,
        'trailer_braked': None, 'trailer_unbraked': None, 'towball': None
    }
    
    # Find all tables
    tables = soup.find_all('table')
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                label = cells[0].get_text().strip().lower()
                value_text = cells[1].get_text().strip()
                value = extract_number(value_text)
                
                # Performance
                if 'peak power' in label and 'boost' not in label:
                    specs['peak_power'] = value
                elif 'peak power with boost' in label:
                    specs['peak_power_boost'] = value
                elif 'electrical torque' in label and 'boost' not in label:
                    specs['torque'] = value
                elif 'electrical torque' in label and 'boost' in label:
                    specs['torque_boost'] = value
                elif 'top speed' in label:
                    specs['top_speed'] = value
                elif '0-100' in label and 'boost' not in label:
                    specs['accel_0_100'] = value
                elif '0-100' in label and 'boost' in label:
                    specs['accel_0_100_boost'] = value
                
                # Range & Consumption
                elif 'basic trim wltp range' in label:
                    specs['wltp_basic_range'] = value
                elif 'basic trim wltp consumption' in label and 'loss' not in label:
                    specs['wltp_basic_consumption'] = value
                elif 'basic trim wltp consumption with charging loss' in label:
                    specs['wltp_basic_consumption_loss'] = value
                elif 'top trim wltp range' in label:
                    specs['wltp_top_range'] = value
                elif 'top trim wltp consumption' in label and 'loss' not in label:
                    specs['wltp_top_consumption'] = value
                elif 'top trim wltp consumption with charging loss' in label:
                    specs['wltp_top_consumption_loss'] = value
                
                # Battery & Charging
                elif 'battery gross' in label:
                    specs['battery_gross'] = value
                elif 'battery net' in label:
                    specs['battery_net'] = value
                elif 'max dc charging' in label:
                    specs['max_dc_charging'] = value
                elif 'number of modules' in label:
                    specs['num_modules'] = int(value) if value else None
                elif 'pack configuration' in label:
                    specs['pack_config'] = value_text
                elif 'nominal voltage' in label:
                    specs['nominal_voltage'] = value
                elif 'cathode material' in label:
                    specs['cathode'] = value_text
                
                # Charge Port
                elif label == 'spec' and 'side' in value_text.lower():
                    specs['chargeport_location'] = value_text
                elif 'type chargeport europe' in label:
                    specs['chargeport_eu'] = value_text.split()[0] if value_text else None
                elif 'type chargeport north america' in label:
                    specs['chargeport_na'] = value_text.split()[0] if value_text else None
                elif 'type chargeport china' in label:
                    specs['chargeport_china'] = value_text.split()[0] if value_text else None
                elif 'type chargeport japan' in label:
                    specs['chargeport_japan'] = value_text.split()[0] if value_text else None
                elif 'type chargeport oceania' in label:
                    specs['chargeport_oceania'] = value_text.split()[0] if value_text else None
                
                # Cargo & Towing
                elif 'curb weight' in label:
                    specs['curb_weight'] = value
                elif 'maximum total weight' in label:
                    specs['max_weight'] = value
                elif 'maximum load' in label:
                    specs['max_payload'] = value
                elif 'max roof cargo' in label:
                    specs['max_roof_load'] = value
                elif 'trunk capacity' in label and 'folded' not in label:
                    specs['trunk'] = value
                elif 'trunk capacity with all rear seats folded' in label:
                    specs['trunk_seats_down'] = value
                elif 'size frunk' in label or 'frunk' in label:
                    specs['frunk'] = value
                elif 'max trailer weight braked' in label:
                    specs['trailer_braked'] = value
                elif 'max trailer weight un braked' in label or 'unbraked' in label:
                    specs['trailer_unbraked'] = value
                elif 'maximum tow ball weight' in label:
                    specs['towball'] = value
    
    # Extract dimensions from text (they use a different format)
    dim_patterns = {
        'length': r'Length\s*(\d+)\s*mm',
        'height': r'Height\s*(\d+)\s*mm',
        'width': r'Width excluding mirrors\s*(\d+)\s*mm',
        'width_mirrors': r'Width including mirrors\s*(\d+)\s*mm',
        'wheelbase': r'Wheelbase\s*(\d+)\s*mm',
        'track_front': r'Track width front\s*(\d+)\s*mm',
        'track_rear': r'Track width rear\s*(\d+)\s*mm',
        'drag_coef': r'Drag coefficient\s*([\d\.]+)',
        'frontal_area': r'Frontal area\s*([\d\.]+)\s*m',
        'approach_angle': r'Approach Angle\s*(\d+)',
        'departure_angle': r'Departure Angle\s*(\d+)',
        'turning_circle': r'Turning circle\s*([\d\.]+)\s*meter',
        'ground_clearance_max': r'Max ground clearance.*?(\d+)\s*mm',
        'ground_clearance_min': r'Minimum ground clearance.*?(\d+)\s*mm'
    }
    
    for key, pattern in dim_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            specs[key] = float(match.group(1))
    
    # Fallback for basic WLTP range if not in tables
    if not specs['wltp_basic_range']:
        wltp_match = re.search(r'WLTP.*?range.*?([\d]+)\s*km', text, re.IGNORECASE)
        if wltp_match:
            specs['wltp_basic_range'] = float(wltp_match.group(1))

    # Insert Vehicle with all specs
    cursor.execute('''
        INSERT OR IGNORE INTO vehicles (
            make, model, variant, variant_url, country,
            battery_gross_kwh, battery_net_kwh, wltp_range_km,
            peak_power_kw, peak_power_boost_kw, torque_nm, torque_boost_nm,
            top_speed_kph, acceleration_0_100_s, acceleration_0_100_boost_s,
            wltp_basic_range_km, wltp_basic_consumption_kwh_100km, wltp_basic_consumption_with_loss_kwh_100km,
            wltp_top_range_km, wltp_top_consumption_kwh_100km, wltp_top_consumption_with_loss_kwh_100km,
            max_dc_charging_kw, num_modules, pack_configuration, nominal_voltage_v, cathode_material,
            chargeport_location, chargeport_type_eu, chargeport_type_na, chargeport_type_china, chargeport_type_japan, chargeport_type_oceania,
            length_mm, height_mm, width_mm, width_with_mirrors_mm, wheelbase_mm,
            track_width_front_mm, track_width_rear_mm, drag_coefficient, frontal_area_m2,
            approach_angle_deg, departure_angle_deg, turning_circle_m,
            ground_clearance_max_mm, ground_clearance_min_mm,
            curb_weight_kg, max_weight_kg, max_payload_kg, max_roof_load_kg,
            trunk_capacity_l, trunk_capacity_seats_down_l, frunk_capacity_l,
            max_trailer_weight_braked_kg, max_trailer_weight_unbraked_kg, max_towball_weight_kg
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        make, model, variant_name, variant_url, country,
        specs['battery_gross'], specs['battery_net'], specs['wltp_basic_range'],
        specs['peak_power'], specs['peak_power_boost'], specs['torque'], specs['torque_boost'],
        specs['top_speed'], specs['accel_0_100'], specs['accel_0_100_boost'],
        specs['wltp_basic_range'], specs['wltp_basic_consumption'], specs['wltp_basic_consumption_loss'],
        specs['wltp_top_range'], specs['wltp_top_consumption'], specs['wltp_top_consumption_loss'],
        specs['max_dc_charging'], specs['num_modules'], specs['pack_config'], specs['nominal_voltage'], specs['cathode'],
        specs['chargeport_location'], specs['chargeport_eu'], specs['chargeport_na'], specs['chargeport_china'], specs['chargeport_japan'], specs['chargeport_oceania'],
        specs['length'], specs['height'], specs['width'], specs['width_mirrors'], specs['wheelbase'],
        specs['track_front'], specs['track_rear'], specs['drag_coef'], specs['frontal_area'],
        specs['approach_angle'], specs['departure_angle'], specs['turning_circle'],
        specs['ground_clearance_max'], specs['ground_clearance_min'],
        specs['curb_weight'], specs['max_weight'], specs['max_payload'], specs['max_roof_load'],
        specs['trunk'], specs['trunk_seats_down'], specs['frunk'],
        specs['trailer_braked'], specs['trailer_unbraked'], specs['towball']
    ))
    
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
        print(f"Scraping Make: {make['name']} ({make.get('country', 'Unknown')})")
        models = scrape_models(make['url'])
        
        for model in models:
            variants = scrape_variants(model['url'])
            
            if not variants:
                # Sometimes the model page IS the variant page
                scrape_variant_details(model['url'], make['name'], model['name'], model['name'], make.get('country'), cursor, conn)
            else:
                for variant in variants:
                    scrape_variant_details(variant['url'], make['name'], model['name'], variant['name'], make.get('country'), cursor, conn)
        
    conn.close()
    print("Scraping complete. Data saved to ev_data.db")

if __name__ == "__main__":
    main()