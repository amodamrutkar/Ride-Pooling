// Nashik Geographic Nodes, Corridors, and Mock Telemetry
export const NASHIK_HUBS = [
  { id: "cbs", name: "CBS Chowk, Nashik", shortName: "CBS Chowk", lat: 19.9977, lon: 73.7803, tag: "Central Terminal" },
  { id: "college_rd", name: "College Road", shortName: "College Rd", lat: 20.0066, lon: 73.7609, tag: "Commercial/Academic" },
  { id: "gangapur_rd", name: "Gangapur Road", shortName: "Gangapur Rd", lat: 20.0116, lon: 73.7595, tag: "Residential/Corridor" },
  { id: "panchavati", name: "Panchavati", shortName: "Panchavati", lat: 20.0069, lon: 73.7930, tag: "Heritage Hub" },
  { id: "dwarka", name: "Dwarka Circle", shortName: "Dwarka", lat: 19.9931, lon: 73.8037, tag: "Transit Junction" },
  { id: "indira_nagar", name: "Indira Nagar", shortName: "Indira Nagar", lat: 19.9742, lon: 73.7819, tag: "South Suburb" },
  { id: "satpur_midc", name: "Satpur MIDC", shortName: "Satpur MIDC", lat: 19.9974, lon: 73.7213, tag: "Industrial Tech" },
  { id: "nashik_road", name: "Nashik Road Station", shortName: "Nashik Rd", lat: 19.9472, lon: 73.8421, tag: "Railway Terminal" },
  { id: "deolali", name: "Deolali Camp", shortName: "Deolali", lat: 19.8901, lon: 73.8265, tag: "Cantonment Zone" },
  { id: "cidco", name: "CIDCO", shortName: "CIDCO", lat: 19.9727, lon: 73.7579, tag: "Urban Sector" },
  { id: "ambad_midc", name: "Ambad MIDC", shortName: "Ambad", lat: 19.9515, lon: 73.7362, tag: "Industrial Belt" },
  { id: "mumbai_naka", name: "Mumbai Naka", shortName: "Mumbai Naka", lat: 19.9878, lon: 73.7825, tag: "Express Link" },
  { id: "ashok_stambh", name: "Ashok Stambh", shortName: "Ashok Stambh", lat: 20.0020, lon: 73.7870, tag: "Civic Center" },
  { id: "navashya", name: "Navashya Ganpati Ghat", shortName: "Navashya", lat: 20.0165, lon: 73.7422, tag: "Riverfront" },
  { id: "kapila", name: "Kapila Sangam Ghat", shortName: "Kapila Sangam", lat: 19.9984, lon: 73.8143, tag: "Riverfront Link" },
  // Newly Added Verified Nashik Urban Landmarks & Arterials
  { id: "govind_nagar", name: "Govind Nagar", shortName: "Govind Nagar", lat: 19.9822, lon: 73.7684, tag: "Residential Hub" },
  { id: "city_centre_mall", name: "City Centre Mall, Untwadi", shortName: "City Centre Mall", lat: 19.9885, lon: 73.7635, tag: "Retail & Transit" },
  { id: "mahatma_nagar", name: "Mahatma Nagar", shortName: "Mahatma Nagar", lat: 20.0035, lon: 73.7485, tag: "Academic & Sports" },
  { id: "parijat_nagar", name: "Parijat Nagar", shortName: "Parijat Nagar", lat: 19.9982, lon: 73.7548, tag: "Midtown Residential" },
  { id: "pathardi_phata", name: "Pathardi Phata", shortName: "Pathardi Phata", lat: 19.9405, lon: 73.7658, tag: "South Highway Junction" },
  { id: "jail_road", name: "Jail Road, Nashik Road", shortName: "Jail Road", lat: 19.9580, lon: 73.8325, tag: "Railway Suburban" },
  { id: "adgaon_naka", name: "Adgaon Naka (Highway Hub)", shortName: "Adgaon Naka", lat: 20.0385, lon: 73.8315, tag: "Highway & Medical Hub" }
];

export const CORRIDORS = [
  {
    id: "c-central",
    name: "CBS ➔ College Rd ➔ Gangapur Rd",
    code: "Central City Spine",
    subtitle: "Commercial & Academic Corridor",
    color: "#0ED4A8",
    category: "express high",
    isExpress: true,
    matchRate: 88,
    status: "Active",
    stops: ["CBS Chowk", "College Rd", "Gangapur Road"],
    liveVehicles: 6,
    avgWait: "1m 50s",
    path: [
      [19.9977, 73.7803],
      [20.0020, 73.7870],
      [20.0066, 73.7609],
      [20.0116, 73.7595]
    ]
  },
  {
    id: "c-station",
    name: "Nashik Road ➔ Dwarka ➔ CBS Chowk",
    code: "Railway Transit Link",
    subtitle: "Station Express Corridor",
    color: "#9d86e9",
    category: "express high",
    isExpress: true,
    matchRate: 93,
    status: "Active",
    stops: ["Nashik Road Station", "Dwarka", "CBS Chowk"],
    liveVehicles: 7,
    avgWait: "1m 30s",
    path: [
      [19.9472, 73.8421],
      [19.9931, 73.8037],
      [19.9977, 73.7803]
    ]
  },
  {
    id: "c-express-retail",
    name: "College Rd ➔ City Centre Mall ➔ Govind Nagar",
    code: "Midtown Commercial Express",
    subtitle: "Direct Retail & Residential Link",
    color: "#38bdf8",
    category: "express high",
    isExpress: true,
    matchRate: 95,
    status: "Active",
    stops: ["College Road", "City Centre Mall", "Govind Nagar"],
    liveVehicles: 6,
    avgWait: "1m 40s",
    path: [
      [20.0066, 73.7609],
      [19.9885, 73.7635],
      [19.9822, 73.7684]
    ]
  },
  {
    id: "c-express-south",
    name: "Pathardi Phata ➔ Indira Nagar ➔ Mumbai Naka",
    code: "NH-3 Radial Express",
    subtitle: "South Highway Gateway Express",
    color: "#f59e0b",
    category: "express",
    isExpress: true,
    matchRate: 91,
    status: "Active",
    stops: ["Pathardi Phata", "Indira Nagar", "Mumbai Naka"],
    liveVehicles: 5,
    avgWait: "2m 10s",
    path: [
      [19.9405, 73.7658],
      [19.9742, 73.7819],
      [19.9878, 73.7825]
    ]
  },
  {
    id: "c-west-academic",
    name: "Mahatma Nagar ➔ Parijat Nagar ➔ College Rd",
    code: "Academic Green Line",
    subtitle: "West Academic & Sports Express",
    color: "#10b981",
    category: "express",
    isExpress: true,
    matchRate: 89,
    status: "Active",
    stops: ["Mahatma Nagar", "Parijat Nagar", "College Road"],
    liveVehicles: 5,
    avgWait: "2m 00s",
    path: [
      [20.0035, 73.7485],
      [19.9982, 73.7548],
      [20.0066, 73.7609]
    ]
  },
  {
    id: "c-east-railway",
    name: "Jail Road ➔ Nashik Road Station ➔ Dwarka",
    code: "Suburban Railway Connector",
    subtitle: "High-Frequency Station Shuttle",
    color: "#a855f7",
    category: "express high",
    isExpress: true,
    matchRate: 94,
    status: "Active",
    stops: ["Jail Road", "Nashik Road Station", "Dwarka"],
    liveVehicles: 6,
    avgWait: "1m 35s",
    path: [
      [19.9580, 73.8325],
      [19.9472, 73.8421],
      [19.9931, 73.8037]
    ]
  },
  {
    id: "c-heritage",
    name: "Panchavati ➔ Kapila Sangam ➔ Ashok Stambh",
    code: "Heritage Riverfront Line",
    subtitle: "Old City & Riverfront Transit",
    color: "#14b8a6",
    category: "express",
    isExpress: true,
    matchRate: 86,
    status: "Active",
    stops: ["Panchavati", "Kapila Sangam", "Ashok Stambh"],
    liveVehicles: 5,
    avgWait: "2m 30s",
    path: [
      [20.0069, 73.7930],
      [19.9984, 73.8143],
      [20.0020, 73.7870]
    ]
  },
  {
    id: "c-tech",
    name: "Satpur MIDC ➔ CIDCO ➔ Indira Nagar",
    code: "Tech & Industrial Belt",
    subtitle: "Industrial Suburban Corridor",
    color: "#38bdf8",
    category: "high",
    isExpress: false,
    matchRate: 82,
    status: "Active",
    stops: ["Satpur MIDC", "CIDCO", "Indira Nagar"],
    liveVehicles: 5,
    avgWait: "3m 40s",
    path: [
      [19.9974, 73.7213],
      [19.9727, 73.7579],
      [19.9742, 73.7819]
    ]
  },
  {
    id: "c-south",
    name: "Ambad MIDC ➔ CIDCO ➔ Mumbai Naka",
    code: "South Industrial Link",
    subtitle: "Manufacturing & Arterial Corridor",
    color: "#f59e0b",
    category: "high",
    isExpress: false,
    matchRate: 88,
    status: "Active",
    stops: ["Ambad MIDC", "CIDCO", "Mumbai Naka"],
    liveVehicles: 4,
    avgWait: "3m 15s",
    path: [
      [19.9515, 73.7362],
      [19.9727, 73.7579],
      [19.9878, 73.7825]
    ]
  }
];

export const FLEET_VEHICLES = [
  {
    id: "V1",
    model: "Tata Tigor EV",
    license: "IN-MH15-8821",
    status: "transit",
    statusLabel: "IN TRANSIT",
    routeVector: "CBS Chowk ➔ College Rd",
    speed: "36 km/h",
    soc: "84%",
    driver: "Sunil Shinde",
    driverBadge: "Verified Pilot",
    driverGender: "male",
    seatsTotal: 4,
    seatsOccupied: 3,
    lat: 19.9977,
    lon: 73.7803
  },
  {
    id: "V2",
    model: "Tata Tiago EV",
    license: "IN-MH15-4109",
    status: "transit",
    statusLabel: "IN TRANSIT",
    routeVector: "Satpur MIDC ➔ CIDCO",
    speed: "38 km/h",
    soc: "78%",
    driver: "Pooja Deshmukh",
    driverBadge: "Women-Verified Pilot",
    driverGender: "female",
    seatsTotal: 4,
    seatsOccupied: 2,
    lat: 19.9850,
    lon: 73.7396
  },
  {
    id: "V3",
    model: "Tata Nexon EV",
    license: "IN-MH15-9944",
    status: "terminal",
    statusLabel: "AT TERMINAL",
    routeVector: "Staged at CBS Terminal Bay 2",
    speed: "0 km/h",
    soc: "95%",
    driver: "Anjali Patil",
    driverBadge: "Women-Verified Pilot",
    driverGender: "female",
    seatsTotal: 4,
    seatsOccupied: 0,
    lat: 20.0012,
    lon: 73.7715
  },
  {
    id: "V4",
    model: "MG ZS EV",
    license: "IN-MH15-6218",
    status: "transit",
    statusLabel: "IN TRANSIT",
    routeVector: "Dwarka Circle ➔ Nashik Road",
    speed: "48 km/h",
    soc: "74%",
    driver: "Vikram Kulkarni",
    driverBadge: "Verified Pilot",
    driverGender: "male",
    seatsTotal: 4,
    seatsOccupied: 4,
    lat: 19.9701,
    lon: 73.8229
  },
  {
    id: "V5",
    model: "Hyundai Kona EV",
    license: "IN-MH15-3390",
    status: "terminal",
    statusLabel: "AT TERMINAL",
    routeVector: "Staged at Nashik Road Depot",
    speed: "0 km/h",
    soc: "88%",
    driver: "Sunita Shinde",
    driverBadge: "Women-Verified Pilot",
    driverGender: "female",
    seatsTotal: 4,
    seatsOccupied: 0,
    lat: 19.9472,
    lon: 73.8421
  },
  {
    id: "V6",
    model: "Tata Tigor EV",
    license: "IN-MH15-1123",
    status: "maintenance",
    statusLabel: "MAINTENANCE",
    routeVector: "Ambad Depot DC Fast Charging",
    speed: "0 km/h",
    soc: "32%",
    driver: "Depot Technical Crew",
    driverBadge: "Technical Ops",
    driverGender: "neutral",
    seatsTotal: 4,
    seatsOccupied: 0,
    lat: 19.9515,
    lon: 73.7362
  }
];
