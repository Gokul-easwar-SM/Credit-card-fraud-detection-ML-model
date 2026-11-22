"""Registered bank terminals, ATMs, and merchant payment infrastructure.

Provides realistic terminal and merchant lookup for bank payment processing:
- POS physical merchant terminals (with verified GPS coordinates)
- ATM cash dispenser terminals (with branch and verified coordinates)
- E-Commerce payment gateways
- IP geolocation ranges for online transactions
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TerminalInfo:
    terminal_id: str
    merchant_id: str
    merchant_name: str
    merchant_category: str
    channel: str  # "pos", "atm", "online"
    city: str
    lat: float
    lon: float
    address: str


# Catalog of registered banking terminals across Indian payment corridors
REGISTERED_TERMINALS: dict[str, TerminalInfo] = {
    # Coimbatore Corridors
    "TERM-CBE-POS-101": TerminalInfo(
        terminal_id="TERM-CBE-POS-101",
        merchant_id="MERCH-CBE-CAFE-01",
        merchant_name="Starbucks Coffee RS Puram",
        merchant_category="food_and_dining",
        channel="pos",
        city="Coimbatore",
        lat=11.0125,
        lon=76.9535,
        address="DB Road, RS Puram, Coimbatore, Tamil Nadu",
    ),
    "TERM-CBE-POS-102": TerminalInfo(
        terminal_id="TERM-CBE-POS-102",
        merchant_id="MERCH-CBE-RET-02",
        merchant_name="Brookefields Superstore",
        merchant_category="grocery",
        channel="pos",
        city="Coimbatore",
        lat=11.0180,
        lon=76.9640,
        address="Brookefields Mall, Krishnaswamy Rd, Coimbatore",
    ),
    "TERM-CBE-POS-103": TerminalInfo(
        terminal_id="TERM-CBE-POS-103",
        merchant_id="MERCH-CBE-FUEL-03",
        merchant_name="Shell Fuel Station Peelamedu",
        merchant_category="fuel",
        channel="pos",
        city="Coimbatore",
        lat=11.0289,
        lon=77.0120,
        address="Avinashi Road, Peelamedu, Coimbatore",
    ),
    "ATM-CBE-01": TerminalInfo(
        terminal_id="ATM-CBE-01",
        merchant_id="BANK-ATM-CBE-01",
        merchant_name="SBI ATM RS Puram Main Branch",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Coimbatore",
        lat=11.0150,
        lon=76.9520,
        address="Diwan Bahadur Rd, RS Puram, Coimbatore",
    ),

    # Chennai Corridors
    "TERM-CHE-POS-201": TerminalInfo(
        terminal_id="TERM-CHE-POS-201",
        merchant_id="MERCH-CHE-HLTH-01",
        merchant_name="Apollo Pharmacy T. Nagar",
        merchant_category="health",
        channel="pos",
        city="Chennai",
        lat=13.0418,
        lon=80.2341,
        address="Usman Road, T. Nagar, Chennai, Tamil Nadu",
    ),
    "TERM-CHE-POS-202": TerminalInfo(
        terminal_id="TERM-CHE-POS-202",
        merchant_id="MERCH-CHE-MALL-02",
        merchant_name="Phoenix Marketcity Lifestyle",
        merchant_category="retail",
        channel="pos",
        city="Chennai",
        lat=12.9915,
        lon=80.2170,
        address="Velachery Main Rd, Chennai",
    ),
    "ATM-CHE-01": TerminalInfo(
        terminal_id="ATM-CHE-01",
        merchant_id="BANK-ATM-CHE-01",
        merchant_name="HDFC Bank 24x7 ATM Anna Nagar",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Chennai",
        lat=13.0850,
        lon=80.2150,
        address="2nd Avenue, Anna Nagar, Chennai",
    ),

    # Bengaluru Corridors
    "TERM-BLR-POS-301": TerminalInfo(
        terminal_id="TERM-BLR-POS-301",
        merchant_id="MERCH-BLR-GROC-01",
        merchant_name="Nature's Basket Indiranagar",
        merchant_category="grocery",
        channel="pos",
        city="Bengaluru",
        lat=12.9784,
        lon=77.6408,
        address="100 Feet Rd, Indiranagar, Bengaluru, Karnataka",
    ),
    "TERM-BLR-POS-302": TerminalInfo(
        terminal_id="TERM-BLR-POS-302",
        merchant_id="MERCH-BLR-CAFE-02",
        merchant_name="Third Wave Coffee Koramangala",
        merchant_category="food_and_dining",
        channel="pos",
        city="Bengaluru",
        lat=12.9352,
        lon=77.6245,
        address="80 Feet Road, 4th Block, Koramangala, Bengaluru",
    ),
    "ATM-BLR-01": TerminalInfo(
        terminal_id="ATM-BLR-01",
        merchant_id="BANK-ATM-BLR-01",
        merchant_name="ICICI Bank ATM MG Road Metro",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Bengaluru",
        lat=12.9756,
        lon=77.6067,
        address="MG Road Boulevard, Bengaluru",
    ),

    # Mumbai Corridors
    "TERM-MUM-POS-401": TerminalInfo(
        terminal_id="TERM-MUM-POS-401",
        merchant_id="MERCH-MUM-JWL-01",
        merchant_name="Zaveri Jewellers Kalbadevi",
        merchant_category="jewelry_and_luxury",
        channel="pos",
        city="Mumbai",
        lat=18.9510,
        lon=72.8315,
        address="Zaveri Bazaar, Kalbadevi, Mumbai, Maharashtra",
    ),
    "TERM-MUM-POS-402": TerminalInfo(
        terminal_id="TERM-MUM-POS-402",
        merchant_id="MERCH-MUM-ELEC-02",
        merchant_name="Tata Croma Electronics Bandra West",
        merchant_category="electronics",
        channel="pos",
        city="Mumbai",
        lat=19.0596,
        lon=72.8295,
        address="Linking Road, Bandra West, Mumbai",
    ),
    "ATM-MUM-01": TerminalInfo(
        terminal_id="ATM-MUM-01",
        merchant_id="BANK-ATM-MUM-01",
        merchant_name="Axis Bank ATM Nariman Point",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Mumbai",
        lat=18.9260,
        lon=72.8230,
        address="Mittal Towers, Nariman Point, Mumbai",
    ),

    # Delhi Corridors
    "TERM-DEL-POS-501": TerminalInfo(
        terminal_id="TERM-DEL-POS-501",
        merchant_id="MERCH-DEL-ELEC-01",
        merchant_name="Croma Mega Store Connaught Place",
        merchant_category="electronics",
        channel="pos",
        city="Delhi",
        lat=28.6315,
        lon=77.2167,
        address="Inner Circle, Block C, Connaught Place, New Delhi",
    ),
    "TERM-DEL-POS-502": TerminalInfo(
        terminal_id="TERM-DEL-POS-502",
        merchant_id="MERCH-DEL-LUX-02",
        merchant_name="DLF Promenade Luxury Brands",
        merchant_category="jewelry_and_luxury",
        channel="pos",
        city="Delhi",
        lat=28.5398,
        lon=77.1554,
        address="Nelson Mandela Marg, Vasant Kunj, New Delhi",
    ),
    "ATM-DEL-01": TerminalInfo(
        terminal_id="ATM-DEL-01",
        merchant_id="BANK-ATM-DEL-01",
        merchant_name="Canara Bank ATM Connaught Circus",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Delhi",
        lat=28.6328,
        lon=77.2195,
        address="Radial Road 3, Connaught Place, New Delhi",
    ),

    # Kolkata Corridors
    "TERM-KOL-POS-701": TerminalInfo(
        terminal_id="TERM-KOL-POS-701",
        merchant_id="MERCH-KOL-MALL-01",
        merchant_name="South City Mall Central Arcade",
        merchant_category="retail",
        channel="pos",
        city="Kolkata",
        lat=22.5015,
        lon=88.3618,
        address="Prince Anwar Shah Rd, Kolkata, West Bengal",
    ),
    "ATM-KOL-01": TerminalInfo(
        terminal_id="ATM-KOL-01",
        merchant_id="BANK-ATM-KOL-01",
        merchant_name="PNB ATM Park Street Heritage",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Kolkata",
        lat=22.5510,
        lon=88.3520,
        address="Mother Teresa Sarani, Park Street, Kolkata",
    ),

    # Kochi Corridors
    "TERM-KOC-POS-801": TerminalInfo(
        terminal_id="TERM-KOC-POS-801",
        merchant_id="MERCH-KOC-MALL-01",
        merchant_name="Lulu International Shopping Mall",
        merchant_category="retail",
        channel="pos",
        city="Kochi",
        lat=10.0270,
        lon=76.3080,
        address="NH 544, Edappally, Kochi, Kerala",
    ),
    "ATM-KOC-01": TerminalInfo(
        terminal_id="ATM-KOC-01",
        merchant_id="BANK-ATM-KOC-01",
        merchant_name="Federal Bank ATM Marine Drive",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Kochi",
        lat=9.9815,
        lon=76.2750,
        address="Shanmugham Rd, Marine Drive, Kochi",
    ),

    # Hyderabad Corridors
    "TERM-HYD-POS-601": TerminalInfo(
        terminal_id="TERM-HYD-POS-601",
        merchant_id="MERCH-HYD-MALL-01",
        merchant_name="Inorbit Mall Cyberabad",
        merchant_category="retail",
        channel="pos",
        city="Hyderabad",
        lat=17.4359,
        lon=78.3828,
        address="Mindspace Madhapur, Hyderabad, Telangana",
    ),
    "ATM-HYD-01": TerminalInfo(
        terminal_id="ATM-HYD-01",
        merchant_id="BANK-ATM-HYD-01",
        merchant_name="SBI ATM Banjara Hills Road No 12",
        merchant_category="atm_cash_withdrawal",
        channel="atm",
        city="Hyderabad",
        lat=17.4150,
        lon=78.4380,
        address="Banjara Hills, Hyderabad",
    ),
}

# Registered Online E-Commerce Gateways
ONLINE_GATEWAYS: dict[str, dict[str, str]] = {
    "GATEWAY-AMZN": {
        "merchant_id": "MERCH-ONL-AMZN",
        "merchant_name": "Amazon India Marketplace",
        "merchant_category": "ecommerce_marketplace",
    },
    "GATEWAY-FLPK": {
        "merchant_id": "MERCH-ONL-FLPK",
        "merchant_name": "Flipkart Internet Services",
        "merchant_category": "ecommerce_marketplace",
    },
    "GATEWAY-SWIG": {
        "merchant_id": "MERCH-ONL-SWIG",
        "merchant_name": "Swiggy Food & Instamart",
        "merchant_category": "food_and_dining",
    },
    "GATEWAY-MMT": {
        "merchant_id": "MERCH-ONL-MMT",
        "merchant_name": "MakeMyTrip Flights & Hotels",
        "merchant_category": "travel_and_hospitality",
    },
    "GATEWAY-APLE": {
        "merchant_id": "MERCH-ONL-APLE",
        "merchant_name": "Apple Online Store India",
        "merchant_category": "electronics",
    },
    "GATEWAY-CRYPTO": {
        "merchant_id": "MERCH-ONL-CRYPTO",
        "merchant_name": "Offshore Virtual Asset Exchange",
        "merchant_category": "crypto_and_high_risk",
    },
}

# Simulated IP Subnet Geolocation Table (for online transactions)
IP_GEOLOCATION_TABLE: dict[str, dict[str, Any]] = {
    "49.37.112.45": {"city": "Coimbatore", "lat": 11.0168, "lon": 76.9558, "isp": "Airtel Broadband"},
    "103.212.44.12": {"city": "Chennai", "lat": 13.0827, "lon": 80.2707, "isp": "ACT Fibernet"},
    "122.171.89.201": {"city": "Bengaluru", "lat": 12.9716, "lon": 77.5946, "isp": "JioFiber Broadband"},
    "14.141.65.18": {"city": "Mumbai", "lat": 19.0760, "lon": 72.8777, "isp": "Tata Teleservices"},
    "115.112.78.90": {"city": "Delhi", "lat": 28.6139, "lon": 77.2090, "isp": "Excitel Broadband"},
    "185.220.101.5": {"city": "Unknown (Tor Exit Node)", "lat": None, "lon": None, "isp": "Tor Anonymizing Proxy", "is_vpn": True},
}


def lookup_terminal(terminal_id: str | None) -> TerminalInfo | None:
    """Find registered POS or ATM terminal by ID."""
    if not terminal_id:
        return None
    return REGISTERED_TERMINALS.get(terminal_id)


def resolve_online_location(ip_address: str | None) -> tuple[float | None, float | None, str | None, str]:
    """Resolve location signals for online transactions.
    
    Returns:
        (lat, lon, city, location_source)
        location_source is one of 'ip_geolocation', 'vpn_proxy_masked', 'missing_ip'
    """
    if not ip_address or not ip_address.strip():
        return None, None, None, "missing_ip"

    geo = IP_GEOLOCATION_TABLE.get(ip_address.strip())
    if geo is None:
        # Generic unmapped public IP
        return None, None, "Unmapped Public IP", "missing_ip"

    if geo.get("is_vpn"):
        return None, None, geo["city"], "vpn_proxy_masked"

    return geo["lat"], geo["lon"], geo["city"], "ip_geolocation"
