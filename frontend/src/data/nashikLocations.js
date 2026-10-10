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
  { id: "adgaon_naka", name: "Adgaon Naka (Highway Hub)", shortName: "Adgaon Naka", lat: 20.0385, lon: 73.8315, tag: "Highway & Medical Hub" },
  // Verified Academic Campuses & North Nashik Hubs
  { id: "pvg_coe", name: "PVG's College of Engineering (Dindori Rd, Mhasrul)", shortName: "PVG COE (Nashik)", lat: 20.0369, lon: 73.8007, tag: "Academic Campus" },
  { id: "meri_mhasrul", name: "MERI Research Institute, Dindori Rd", shortName: "MERI (Dindori Rd)", lat: 20.0270, lon: 73.7995, tag: "Research & Transit" },
  { id: "kbt_coe", name: "KBT College of Engineering, Gangapur Rd", shortName: "KBT COE", lat: 20.0162, lon: 73.7548, tag: "Academic Hub" },
  { id: "kkwagh", name: "KK Wagh Institute of Engg, Amrutdham", shortName: "KK Wagh COE", lat: 20.0135, lon: 73.8228, tag: "Academic Campus" },
  { id: "met_bhujbal", name: "MET Bhujbal Knowledge City, Adgaon", shortName: "MET Campus", lat: 20.0435, lon: 73.8492, tag: "Academic Campus" }
];

export const CORRIDORS = [
  // ─── 1. EXPRESS RADIAL TRUNK HIGHWAYS (Direct, minimal stops) ───
  {
    id: "c-station",
    name: "Nashik Road ➔ Dwarka ➔ CBS Chowk",
    code: "Nashik Road Station Express",
    subtitle: "High-Speed Radial Trunk Road",
    color: "#9d86e9",
    category: "express",
    categoryLabel: "Express Radial",
    isExpress: true,
    matchRate: 94,
    status: "Active",
    stops: ["Nashik Road Station", "Dwarka", "CBS Chowk"],
    liveVehicles: 7,
    avgWait: "1m 30s",
    headwayMin: 2.0,
    capacityTotal: 28,
    capacityOccupied: 22,
    hourlyDemandPax: 165,
    congestionStatus: "Optimal (48 km/h)",
    path: [
      [19.9472, 73.8421],
      [19.9931, 73.8037],
      [19.9977, 73.7803]
    ]
  },
  {
    id: "c-express-south",
    name: "Pathardi Phata ➔ Indira Nagar ➔ Mumbai Naka",
    code: "NH-3 Highway Express Road",
    subtitle: "South Highway Radial Gateway",
    color: "#f59e0b",
    category: "express",
    categoryLabel: "Express Radial",
    isExpress: true,
    matchRate: 91,
    status: "Active",
    stops: ["Pathardi Phata", "Indira Nagar", "Mumbai Naka"],
    liveVehicles: 5,
    avgWait: "2m 10s",
    headwayMin: 2.5,
    capacityTotal: 20,
    capacityOccupied: 15,
    hourlyDemandPax: 130,
    congestionStatus: "Fast Arterial (50 km/h)",
    path: [
      [19.9405, 73.7658],
      [19.9742, 73.7819],
      [19.9878, 73.7825]
    ]
  },
  {
    id: "c-express-retail",
    name: "College Rd ➔ City Centre Mall ➔ Govind Nagar",
    code: "Midtown Commercial Express",
    subtitle: "Direct Retail & Residential Road Link",
    color: "#38bdf8",
    category: "express",
    categoryLabel: "Express Radial",
    isExpress: true,
    matchRate: 95,
    status: "Active",
    stops: ["College Road", "City Centre Mall", "Govind Nagar"],
    liveVehicles: 6,
    avgWait: "1m 40s",
    headwayMin: 2.2,
    capacityTotal: 24,
    capacityOccupied: 19,
    hourlyDemandPax: 148,
    congestionStatus: "Optimal (42 km/h)",
    path: [
      [20.0066, 73.7609],
      [19.9885, 73.7635],
      [19.9822, 73.7684]
    ]
  },
  {
    id: "c-trimbak-express",
    name: "CBS Chowk ➔ Satpur MIDC ➔ Sandip University",
    code: "Trimbak Road Radial Express",
    subtitle: "West University & Industrial Radial Arterial",
    color: "#e11d48",
    category: "express",
    categoryLabel: "Express Radial",
    isExpress: true,
    matchRate: 93,
    status: "Active",
    stops: ["CBS Chowk", "Satpur MIDC", "Sandip University"],
    liveVehicles: 6,
    avgWait: "2m 00s",
    headwayMin: 2.4,
    capacityTotal: 24,
    capacityOccupied: 18,
    hourlyDemandPax: 142,
    congestionStatus: "Arterial Flow (45 km/h)",
    path: [
      [19.9977, 73.7803],
      [19.9974, 73.7213],
      [19.9675, 73.6821]
    ]
  },

  // ─── 2. URBAN ARTERIAL ROADS (Core city multi-stop transit lines) ───
  {
    id: "c-central",
    name: "CBS ➔ College Rd ➔ Gangapur Rd",
    code: "Central City Commercial Spine",
    subtitle: "Core Commercial & Academic Arterial Road",
    color: "#0ED4A8",
    category: "arterial",
    categoryLabel: "Busy Arterial",
    isExpress: false,
    matchRate: 88,
    status: "Active",
    stops: ["CBS Chowk", "College Rd", "Gangapur Road"],
    liveVehicles: 6,
    avgWait: "1m 50s",
    headwayMin: 2.4,
    capacityTotal: 24,
    capacityOccupied: 20,
    hourlyDemandPax: 155,
    congestionStatus: "Moderate Traffic (32 km/h)",
    path: [
      [19.9977, 73.7803],
      [20.0020, 73.7870],
      [20.0066, 73.7609],
      [20.0116, 73.7595]
    ]
  },
  {
    id: "c-tech",
    name: "Satpur MIDC ➔ CIDCO ➔ Indira Nagar",
    code: "Satpur-CIDCO Industrial Road",
    subtitle: "Industrial Commuter Arterial",
    color: "#22d3ee",
    category: "arterial",
    categoryLabel: "Busy Arterial",
    isExpress: false,
    matchRate: 82,
    status: "Active",
    stops: ["Satpur MIDC", "CIDCO", "Indira Nagar"],
    liveVehicles: 5,
    avgWait: "3m 40s",
    headwayMin: 3.5,
    capacityTotal: 20,
    capacityOccupied: 14,
    hourlyDemandPax: 110,
    congestionStatus: "Industrial Corridor (35 km/h)",
    path: [
      [19.9974, 73.7213],
      [19.9727, 73.7579],
      [19.9742, 73.7819]
    ]
  },
  {
    id: "c-south",
    name: "Ambad MIDC ➔ CIDCO ➔ Mumbai Naka",
    code: "Ambad-Mumbai Naka Spine",
    subtitle: "South Manufacturing Arterial Link",
    color: "#fb923c",
    category: "arterial",
    categoryLabel: "Busy Arterial",
    isExpress: false,
    matchRate: 88,
    status: "Active",
    stops: ["Ambad MIDC", "CIDCO", "Mumbai Naka"],
    liveVehicles: 5,
    avgWait: "3m 15s",
    headwayMin: 3.2,
    capacityTotal: 20,
    capacityOccupied: 16,
    hourlyDemandPax: 125,
    congestionStatus: "Arterial Flow (38 km/h)",
    path: [
      [19.9515, 73.7362],
      [19.9727, 73.7579],
      [19.9878, 73.7825]
    ]
  },
  {
    id: "c-panchavati-spine",
    name: "Panchavati ➔ Ashok Stambh ➔ CBS Chowk",
    code: "Old City Civic Spine",
    subtitle: "High-Traffic Heritage Center Arterial",
    color: "#ec4899",
    category: "arterial",
    categoryLabel: "Busy Arterial",
    isExpress: false,
    matchRate: 90,
    status: "Active",
    stops: ["Panchavati", "Ashok Stambh", "CBS Chowk"],
    liveVehicles: 6,
    avgWait: "1m 45s",
    headwayMin: 2.2,
    capacityTotal: 24,
    capacityOccupied: 19,
    hourlyDemandPax: 145,
    congestionStatus: "Dense City Flow (30 km/h)",
    path: [
      [20.0069, 73.7930],
      [20.0020, 73.7870],
      [19.9977, 73.7803]
    ]
  },
  {
    id: "c-dwarka-arterial",
    name: "Dwarka ➔ Mumbai Naka ➔ CBS Chowk",
    code: "Dwarka Highway Arterial",
    subtitle: "High-Demand Central Connecting Road",
    color: "#8b5cf6",
    category: "arterial",
    categoryLabel: "Busy Arterial",
    isExpress: false,
    matchRate: 92,
    status: "Active",
    stops: ["Dwarka", "Mumbai Naka", "CBS Chowk"],
    liveVehicles: 6,
    avgWait: "1m 50s",
    headwayMin: 2.1,
    capacityTotal: 24,
    capacityOccupied: 20,
    hourlyDemandPax: 152,
    congestionStatus: "Heavy Traffic (29 km/h)",
    path: [
      [19.9931, 73.8037],
      [19.9878, 73.7825],
      [19.9977, 73.7803]
    ]
  },

  // ─── 3. CAMPUS & COLLEGE ROADS (Heavy student & commuter transit) ───
  {
    id: "c-dindori-academic",
    name: "PVG COE ➔ MERI Mhasrul ➔ Panchavati",
    code: "Dindori Road College Corridor",
    subtitle: "Heavy Student & Academic Commuter Arterial",
    color: "#10b981",
    category: "campus",
    categoryLabel: "Campus Corridor",
    isExpress: false,
    matchRate: 95,
    status: "Active",
    stops: ["PVG's COE", "MERI Colony", "Panchavati"],
    liveVehicles: 6,
    avgWait: "1m 40s",
    headwayMin: 2.1,
    capacityTotal: 24,
    capacityOccupied: 21,
    hourlyDemandPax: 160,
    congestionStatus: "Campus Flow (38 km/h)",
    path: [
      [20.0369, 73.8007],
      [20.0245, 73.7981],
      [20.0069, 73.7930]
    ]
  },
  {
    id: "c-gangapur-academic",
    name: "Navashya Ganapati ➔ KBT COE ➔ College Rd",
    code: "Gangapur Academic Road",
    subtitle: "Premier West College & Student Belt",
    color: "#06b6d4",
    category: "campus",
    categoryLabel: "Campus Corridor",
    isExpress: false,
    matchRate: 91,
    status: "Active",
    stops: ["Navashya Ganapati", "KBT COE", "College Road"],
    liveVehicles: 5,
    avgWait: "2m 15s",
    headwayMin: 2.6,
    capacityTotal: 20,
    capacityOccupied: 16,
    hourlyDemandPax: 128,
    congestionStatus: "Smooth Academic (40 km/h)",
    path: [
      [20.0152, 73.7381],
      [20.0132, 73.7554],
      [20.0066, 73.7609]
    ]
  },
  {
    id: "c-amrutdham-tech",
    name: "KK Wagh COE ➔ MET Bhujbal Campus ➔ Adgaon Naka",
    code: "Amrutdham Engineering Belt",
    subtitle: "Adgaon Tech & University Hub Road",
    color: "#6366f1",
    category: "campus",
    categoryLabel: "Campus Corridor",
    isExpress: false,
    matchRate: 89,
    status: "Active",
    stops: ["KK Wagh COE", "MET Campus", "Adgaon Naka"],
    liveVehicles: 5,
    avgWait: "2m 20s",
    headwayMin: 2.8,
    capacityTotal: 20,
    capacityOccupied: 15,
    hourlyDemandPax: 122,
    congestionStatus: "Arterial (42 km/h)",
    path: [
      [20.0135, 73.8228],
      [20.0435, 73.8492],
      [20.0289, 73.8345]
    ]
  },
  {
    id: "c-west-academic",
    name: "Mahatma Nagar ➔ Parijat Nagar ➔ College Rd",
    code: "West College Feeder Road",
    subtitle: "Academic & Sports Campus Feeder",
    color: "#84cc16",
    category: "campus",
    categoryLabel: "Campus Corridor",
    isExpress: false,
    matchRate: 89,
    status: "Active",
    stops: ["Mahatma Nagar", "Parijat Nagar", "College Road"],
    liveVehicles: 4,
    avgWait: "2m 00s",
    headwayMin: 3.0,
    capacityTotal: 16,
    capacityOccupied: 11,
    hourlyDemandPax: 95,
    congestionStatus: "Smooth Flow (40 km/h)",
    path: [
      [20.0035, 73.7485],
      [19.9982, 73.7548],
      [20.0066, 73.7609]
    ]
  },
  {
    id: "c-sandip-campus",
    name: "Sandip University ➔ Satpur MIDC ➔ Gangapur Rd",
    code: "Trimbak-Gangapur Academic Cross",
    subtitle: "Cross-City University Transit Road",
    color: "#14b8a6",
    category: "campus",
    categoryLabel: "Campus Corridor",
    isExpress: false,
    matchRate: 86,
    status: "Active",
    stops: ["Sandip University", "Satpur MIDC", "Gangapur Road"],
    liveVehicles: 4,
    avgWait: "2m 50s",
    headwayMin: 3.4,
    capacityTotal: 16,
    capacityOccupied: 12,
    hourlyDemandPax: 105,
    congestionStatus: "Semi-Urban Flow (44 km/h)",
    path: [
      [19.9675, 73.6821],
      [19.9974, 73.7213],
      [20.0116, 73.7595]
    ]
  },

  // ─── 4. SUBURBAN & COMMUTER BELTS (First/last mile & residential links) ───
  {
    id: "c-east-railway",
    name: "Jail Road ➔ Nashik Road Station ➔ Dwarka",
    code: "Jail Road Commuter Link",
    subtitle: "High-Frequency Suburban Station Feeder",
    color: "#a855f7",
    category: "feeder",
    categoryLabel: "Suburban Link",
    isExpress: false,
    matchRate: 94,
    status: "Active",
    stops: ["Jail Road", "Nashik Road Station", "Dwarka"],
    liveVehicles: 5,
    avgWait: "1m 35s",
    headwayMin: 2.5,
    capacityTotal: 20,
    capacityOccupied: 17,
    hourlyDemandPax: 138,
    congestionStatus: "Station Approach (34 km/h)",
    path: [
      [19.9580, 73.8325],
      [19.9472, 73.8421],
      [19.9931, 73.8037]
    ]
  },
  {
    id: "c-deolali-suburban",
    name: "Deolali Camp ➔ Nashik Road ➔ Jail Road",
    code: "Cantonment Commuter Road",
    subtitle: "Military Cantonment & South Station Link",
    color: "#d97706",
    category: "feeder",
    categoryLabel: "Suburban Link",
    isExpress: false,
    matchRate: 87,
    status: "Active",
    stops: ["Deolali Camp", "Nashik Road Station", "Jail Road"],
    liveVehicles: 4,
    avgWait: "2m 30s",
    headwayMin: 3.0,
    capacityTotal: 16,
    capacityOccupied: 12,
    hourlyDemandPax: 98,
    congestionStatus: "Cantonment Flow (38 km/h)",
    path: [
      [19.9142, 73.8315],
      [19.9472, 73.8421],
      [19.9580, 73.8325]
    ]
  },
  {
    id: "c-heritage",
    name: "Panchavati ➔ Kapila Sangam ➔ Ashok Stambh",
    code: "Godavari Riverfront Road",
    subtitle: "Riverfront & Local Market Connector",
    color: "#0d9488",
    category: "feeder",
    categoryLabel: "Suburban Link",
    isExpress: false,
    matchRate: 86,
    status: "Active",
    stops: ["Panchavati", "Kapila Sangam", "Ashok Stambh"],
    liveVehicles: 4,
    avgWait: "2m 30s",
    headwayMin: 3.2,
    capacityTotal: 16,
    capacityOccupied: 10,
    hourlyDemandPax: 88,
    congestionStatus: "Heritage Zone (28 km/h)",
    path: [
      [20.0069, 73.7930],
      [19.9984, 73.8143],
      [20.0020, 73.7870]
    ]
  },
  {
    id: "c-cidco-mall",
    name: "CIDCO ➔ City Centre Mall ➔ Govind Nagar",
    code: "Untwadi Commercial Road",
    subtitle: "Retail Hub & Residential Link Road",
    color: "#0284c7",
    category: "feeder",
    categoryLabel: "Suburban Link",
    isExpress: false,
    matchRate: 90,
    status: "Active",
    stops: ["CIDCO", "City Centre Mall", "Govind Nagar"],
    liveVehicles: 5,
    avgWait: "2m 05s",
    headwayMin: 2.5,
    capacityTotal: 20,
    capacityOccupied: 16,
    hourlyDemandPax: 130,
    congestionStatus: "Midtown Flow (36 km/h)",
    path: [
      [19.9727, 73.7579],
      [19.9885, 73.7635],
      [19.9822, 73.7684]
    ]
  },
  {
    id: "c-adgaon-panchavati",
    name: "Adgaon Naka ➔ KK Wagh COE ➔ Panchavati",
    code: "NH-3 Inbound Commuter Road",
    subtitle: "North-East Arterial Commuter Road",
    color: "#64748b",
    category: "feeder",
    categoryLabel: "Suburban Link",
    isExpress: false,
    matchRate: 88,
    status: "Active",
    stops: ["Adgaon Naka", "KK Wagh COE", "Panchavati"],
    liveVehicles: 4,
    avgWait: "2m 10s",
    headwayMin: 2.8,
    capacityTotal: 16,
    capacityOccupied: 13,
    hourlyDemandPax: 112,
    congestionStatus: "Highway Entry Flow (42 km/h)",
    path: [
      [20.0289, 73.8345],
      [20.0135, 73.8228],
      [20.0069, 73.7930]
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

/**
 * Returns a realistic, dynamic shared ride upstream origin where the vehicle is coming from,
 * representing an existing co-rider's pickup point along the transit network.
 * Strictly constrained within a diameter of MIN 0 KM and MAX 1.5 KM from the pickup location.
 * Dynamic and random each time.
 */
export function getSharedRideOrigin(originHub, destHub, seed = null) {
  if (!originHub) return NASHIK_HUBS[0];

  const MAX_DIAMETER_KM = 1.5;
  const MIN_DIAMETER_KM = 0.25;

  // Authentic local micro-feeder landmarks located strictly within [0.4 km, 1.4 km] of Nashik hubs
  const localFeederMap = {
    pvg_coe: [
      { id: "pvg_mhasrul_gate", name: "Mhasrul Gaon Gate (Dindori Rd)", shortName: "Mhasrul Gate", lat: 20.0335, lon: 73.8042 },
      { id: "pvg_rto_circle", name: "RTO Approach Point (Mhasrul)", shortName: "RTO Approach", lat: 20.0298, lon: 73.8015 },
      { id: "pvg_dindori_toll", name: "Dindori Road Feeder Bay", shortName: "Dindori Rd Bay", lat: 20.0412, lon: 73.8031 },
      { id: "pvg_kasturi", name: "Kasturi Nagar Cross (Mhasrul)", shortName: "Kasturi Nagar", lat: 20.0315, lon: 73.7958 },
      { id: "meri_mhasrul", name: "MERI Colony (Dindori Rd)", shortName: "MERI (Dindori Rd)", lat: 20.0245, lon: 73.7981 }
    ],
    navashya: [
      { id: "navashya_anandwalli", name: "Anandwalli Village Square", shortName: "Anandwalli Sq", lat: 20.0125, lon: 73.7428 },
      { id: "navashya_ghat", name: "Navashya Riverfront Cross", shortName: "Riverfront Cross", lat: 20.0185, lon: 73.7352 },
      { id: "navashya_naka", name: "Gangapur Naka Approach", shortName: "Gangapur Naka", lat: 20.0142, lon: 73.7475 },
      { id: "kbt_coe", name: "NDMVP KBT College of Engineering", shortName: "KBT COE", lat: 20.0132, lon: 73.7554 }
    ],
    cbs: [
      { id: "cbs_shalimar", name: "Shalimar Chowk Point", shortName: "Shalimar Point", lat: 19.9942, lon: 73.7852 },
      { id: "cbs_canada_corner", name: "Canada Corner Approach", shortName: "Canada Corner", lat: 20.0015, lon: 73.7745 },
      { id: "ashok_stambh", name: "Ashok Stambh Central Square", shortName: "Ashok Stambh", lat: 20.0020, lon: 73.7870 },
      { id: "mumbai_naka", name: "Mumbai Naka Gateway", shortName: "Mumbai Naka", lat: 19.9878, lon: 73.7825 }
    ],
    college_rd: [
      { id: "gangapur_rd", name: "Gangapur Road Junction", shortName: "Gangapur Rd", lat: 20.0116, lon: 73.7595 },
      { id: "college_bhonsala", name: "Bhonsala Military School Gate", shortName: "Bhonsala Gate", lat: 20.0028, lon: 73.7552 },
      { id: "college_byk", name: "BYK College Campus Corner", shortName: "BYK Corner", lat: 20.0085, lon: 73.7645 },
      { id: "parijat_nagar", name: "Parijat Nagar Circle", shortName: "Parijat Nagar", lat: 19.9982, lon: 73.7548 },
      { id: "kbt_coe", name: "NDMVP KBT College of Engineering", shortName: "KBT COE", lat: 20.0132, lon: 73.7554 }
    ],
    gangapur_rd: [
      { id: "kbt_coe", name: "NDMVP KBT College of Engineering", shortName: "KBT COE", lat: 20.0132, lon: 73.7554 },
      { id: "college_rd", name: "College Road Midtown", shortName: "College Rd", lat: 20.0066, lon: 73.7609 },
      { id: "gangapur_dhruv", name: "Dhruv Nagar Entry Point", shortName: "Dhruv Nagar", lat: 20.0182, lon: 73.7545 },
      { id: "gangapur_serene", name: "Serene Meadows Approach", shortName: "Serene Meadows", lat: 20.0165, lon: 73.7482 }
    ],
    panchavati: [
      { id: "ashok_stambh", name: "Ashok Stambh Central Square", shortName: "Ashok Stambh", lat: 20.0020, lon: 73.7870 },
      { id: "panchavati_kalaram", name: "Kalaram Mandir Gate", shortName: "Kalaram Gate", lat: 20.0082, lon: 73.7965 },
      { id: "panchavati_nimani", name: "Nimani Bus Stand Point", shortName: "Nimani Stand", lat: 20.0045, lon: 73.7995 },
      { id: "panchavati_ramkund", name: "Ramkund River Ghat", shortName: "Ramkund Ghat", lat: 20.0055, lon: 73.7915 }
    ],
    dwarka: [
      { id: "kapila", name: "Kapila Teerth / Nandur Naka", shortName: "Kapila Sangam", lat: 19.9984, lon: 73.8143 },
      { id: "dwarka_kathe", name: "Kathe Galli Junction", shortName: "Kathe Galli", lat: 19.9882, lon: 73.8005 },
      { id: "dwarka_sarada", name: "Sarada Kanya Vidyalaya Gate", shortName: "Sarada Gate", lat: 19.9915, lon: 73.7955 },
      { id: "dwarka_highway", name: "Dwarka Highway Underpass", shortName: "Dwarka Pass", lat: 19.9962, lon: 73.8078 }
    ],
    nashik_road: [
      { id: "nashik_bitco", name: "Bitco Point Junction", shortName: "Bitco Point", lat: 19.9515, lon: 73.8375 },
      { id: "nashik_datta", name: "Datta Mandir Road Point", shortName: "Datta Mandir", lat: 19.9432, lon: 73.8385 },
      { id: "nashik_muktidham", name: "Muktidham Temple Gate", shortName: "Muktidham Gate", lat: 19.9455, lon: 73.8475 },
      { id: "nashik_artillery", name: "Artillery Centre Gate", shortName: "Artillery Gate", lat: 19.9395, lon: 73.8445 }
    ],
    satpur_midc: [
      { id: "satpur_iti", name: "Trimbak Road ITI Circle", shortName: "ITI Circle", lat: 19.9925, lon: 73.7265 },
      { id: "satpur_nice", name: "NICE Industrial Area Point", shortName: "NICE Area", lat: 20.0025, lon: 73.7185 },
      { id: "satpur_club", name: "Satpur Club House Road", shortName: "Satpur Club", lat: 19.9945, lon: 73.7155 },
      { id: "satpur_carbon", name: "Carbon Naka Junction", shortName: "Carbon Naka", lat: 19.9895, lon: 73.7315 }
    ],
    ambad_midc: [
      { id: "ambad_siemens", name: "Siemens Point Circle", shortName: "Siemens Point", lat: 19.9555, lon: 73.7325 },
      { id: "ambad_garware", name: "Garware Point Gate", shortName: "Garware Point", lat: 19.9475, lon: 73.7395 },
      { id: "ambad_xlo", name: "XLO Point Junction", shortName: "XLO Point", lat: 19.9585, lon: 73.7415 },
      { id: "ambad_mahindra", name: "Mahindra Engine Plant Gate", shortName: "Mahindra Gate", lat: 19.9482, lon: 73.7312 }
    ],
    indira_nagar: [
      { id: "indira_jogging", name: "Indira Nagar Jogging Track", shortName: "Jogging Track", lat: 19.9785, lon: 73.7775 },
      { id: "indira_rane", name: "Rane Nagar Cross Link", shortName: "Rane Nagar", lat: 19.9695, lon: 73.7785 },
      { id: "indira_wadala", name: "Wadala Gaon Road Point", shortName: "Wadala Road", lat: 19.9815, lon: 73.7865 },
      { id: "indira_ggs", name: "Guru Gobind Singh College Gate", shortName: "GGS College", lat: 19.9682, lon: 73.7875 }
    ],
    cidco: [
      { id: "cidco_trimurti", name: "Trimurti Chowk Sector 4", shortName: "Trimurti Sq", lat: 19.9685, lon: 73.7545 },
      { id: "cidco_pavan", name: "Pavan Nagar Stadium Point", shortName: "Pavan Nagar", lat: 19.9765, lon: 73.7535 },
      { id: "cidco_uttam", name: "Uttam Nagar Cross", shortName: "Uttam Nagar", lat: 19.9755, lon: 73.7645 },
      { id: "cidco_lekhnagar", name: "Lekha Nagar Junction", shortName: "Lekha Nagar", lat: 19.9675, lon: 73.7625 }
    ],
    kkwagh: [
      { id: "kkwagh_shani", name: "Amrutdham Shani Mandir", shortName: "Shani Mandir", lat: 20.0185, lon: 73.8185 },
      { id: "kkwagh_rasbihari", name: "Rasbihari School Road Point", shortName: "Rasbihari Road", lat: 20.0215, lon: 73.8265 },
      { id: "kkwagh_toll", name: "Panchavati Toll Naka Approach", shortName: "Toll Approach", lat: 20.0105, lon: 73.8155 },
      { id: "kkwagh_tawli", name: "Tawli Phata Point", shortName: "Tawli Phata", lat: 20.0075, lon: 73.8285 }
    ],
    adgaon_naka: [
      { id: "adgaon_terminal_gate", name: "Truck Terminal North Gate", shortName: "Terminal Gate", lat: 20.0315, lon: 73.8395 },
      { id: "adgaon_jatra", name: "Jatra Hotel Highway Point", shortName: "Jatra Point", lat: 20.0245, lon: 73.8315 },
      { id: "adgaon_medical", name: "Adgaon Medical College Bay", shortName: "Medical Bay", lat: 20.0345, lon: 73.8312 }
    ],
    deolali: [
      { id: "deolali_rest_camp", name: "Rest Camp Road Corner", shortName: "Rest Camp Rd", lat: 19.9195, lon: 73.8355 },
      { id: "deolali_temple_hill", name: "Temple Hill Approach Point", shortName: "Temple Hill", lat: 19.9095, lon: 73.8275 },
      { id: "deolali_lam_road", name: "Lam Road Cantonment Bay", shortName: "Lam Road Bay", lat: 19.9165, lon: 73.8385 }
    ],
    pathardi_phata: [
      { id: "pathardi_prashant", name: "Prashant Nagar Stop", shortName: "Prashant Nagar", lat: 19.9455, lon: 73.7615 },
      { id: "pathardi_gaon", name: "Pathardi Gaon Approach", shortName: "Pathardi Gaon", lat: 19.9355, lon: 73.7695 },
      { id: "pathardi_deolekar", name: "Deolekar Nagar Junction", shortName: "Deolekar Nagar", lat: 19.9435, lon: 73.7715 }
    ],
    jail_road: [
      { id: "jail_dasak", name: "Dasak Gaon Corner", shortName: "Dasak Corner", lat: 19.9625, lon: 73.8285 },
      { id: "jail_shani", name: "Shani Mandir Jail Road", shortName: "Shani Mandir", lat: 19.9545, lon: 73.8365 },
      { id: "jail_upnagar", name: "Upnagar Crossing Point", shortName: "Upnagar Cross", lat: 19.9645, lon: 73.8355 }
    ]
  };

  const candidates = [];

  // 1. Gather all NASHIK_HUBS within diameter [0.25 km, 1.5 km]
  NASHIK_HUBS.forEach((h) => {
    if (h.id === originHub.id) return;
    if (destHub && h.id === destHub.id) return;
    const dist = Math.hypot((h.lat - originHub.lat) * 111, (h.lon - originHub.lon) * 104);
    if (dist >= MIN_DIAMETER_KM && dist <= MAX_DIAMETER_KM) {
      candidates.push({ ...h, distanceToPickupKm: Number(dist.toFixed(2)) });
    }
  });

  // 2. Gather specific micro-feeders mapped to this hub within 1.5 km
  const specificFeeders = localFeederMap[originHub.id] || [];
  specificFeeders.forEach((f) => {
    if (destHub && f.id === destHub.id) return;
    const dist = Math.hypot((f.lat - originHub.lat) * 111, (f.lon - originHub.lon) * 104);
    if (dist <= MAX_DIAMETER_KM) {
      candidates.push({ ...f, distanceToPickupKm: Number(dist.toFixed(2)) });
    }
  });

  // 3. If candidates count is less than 3 (e.g. for custom pinned locations), dynamically generate local points
  if (candidates.length < 3) {
    const radialAngles = [0.75, 2.35, 3.85, 5.45];
    const radialDists = [0.55, 0.85, 1.15, 1.35]; // All strictly <= 1.4 km

    radialAngles.forEach((angle, idx) => {
      const d = radialDists[idx % radialDists.length];
      const dLat = (d / 111.0) * Math.cos(angle);
      const dLon = (d / 104.0) * Math.sin(angle);
      const lat = Number((originHub.lat + dLat).toFixed(6));
      const lon = Number((originHub.lon + dLon).toFixed(6));
      const dist = Math.hypot((lat - originHub.lat) * 111, (lon - originHub.lon) * 104);

      if (dist <= MAX_DIAMETER_KM) {
        const directions = ["North-East", "North-West", "South-West", "South-East"];
        const dirName = directions[idx % directions.length];
        candidates.push({
          id: `${originHub.id || 'pickup'}_feeder_${idx + 1}`,
          name: `${originHub.shortName || 'Pickup'} ${dirName} Bay (${d.toFixed(1)} km)`,
          shortName: `${originHub.shortName || 'Local'} ${dirName} (${d.toFixed(1)} km)`,
          lat,
          lon,
          distanceToPickupKm: Number(dist.toFixed(2))
        });
      }
    });
  }

  // Filter out any accidental candidates with dist > 1.5 km
  const validCandidates = candidates.filter((c) => {
    const dist = Math.hypot((c.lat - originHub.lat) * 111, (c.lon - originHub.lon) * 104);
    return dist <= MAX_DIAMETER_KM;
  });

  if (validCandidates.length === 0) {
    // Guaranteed fallback: 0.8 km offset from pickup
    const fLat = originHub.lat + (0.8 / 111.0);
    const fLon = originHub.lon + (0.3 / 104.0);
    return {
      id: `${originHub.id || 'pickup'}_feeder_bay`,
      name: `${originHub.shortName || 'Pickup'} Local Feeder (0.8 km)`,
      shortName: `${originHub.shortName || 'Pickup'} Feeder (0.8 km)`,
      lat: Number(fLat.toFixed(6)),
      lon: Number(fLon.toFixed(6)),
      distanceToPickupKm: 0.85
    };
  }

  // Pick dynamically & randomly each time (or deterministically by seed)
  const pickIndex = typeof seed === 'number'
    ? Math.abs(seed) % validCandidates.length
    : Math.floor(Math.random() * validCandidates.length);

  return validCandidates[pickIndex];
}
