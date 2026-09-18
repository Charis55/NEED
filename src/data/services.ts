export interface SubService {
  id: string;
  title: string;
  description: string;
}

export interface ServiceCategory {
  id: string;
  title: string;
  subServices: SubService[];
}

export const servicesData: Record<string, ServiceCategory> = {
  "plumbing": {
    id: "plumbing",
    title: "Plumbing",
    subServices: [
      { id: "kitchen-sink-installation-and-replacement", title: "Kitchen sink installation and replacement", description: "Kitchen sink installation and replacement" },
      { id: "kitchen-sink-drain-unclogging", title: "Kitchen sink drain unclogging", description: "Kitchen sink drain unclogging" },
      { id: "kitchen-mixer-tap-and-faucet-repair", title: "Kitchen mixer tap and faucet repair", description: "Kitchen mixer tap and faucet repair" },
      { id: "under-sink-pipe-leak-repair", title: "Under-sink pipe leak repair", description: "Under-sink pipe leak repair" },
      { id: "dishwasher-plumbing-connection", title: "Dishwasher plumbing connection", description: "Dishwasher plumbing connection" },
      { id: "bathroom-sink-or-basin-installation", title: "Bathroom sink or basin installation", description: "Bathroom sink or basin installation" },
      { id: "bathroom-sink-drain-unclogging", title: "Bathroom sink drain unclogging", description: "Bathroom sink drain unclogging" },
      { id: "bathroom-tap-and-faucet-repair", title: "Bathroom tap and faucet repair", description: "Bathroom tap and faucet repair" },
      { id: "toilet-installation", title: "Toilet installation", description: "Toilet installation" },
      { id: "toilet-flush-tank-repair", title: "Toilet flush tank repair", description: "Toilet flush tank repair" },
      { id: "toilet-bowl-base-leak-repair", title: "Toilet bowl base leak repair", description: "Toilet bowl base leak repair" },
      { id: "blocked-toilet-clearing", title: "Blocked toilet clearing", description: "Blocked toilet clearing" },
      { id: "shower-mixer-and-shower-head-repair", title: "Shower mixer and shower head repair", description: "Shower mixer and shower head repair" },
      { id: "bathtub-installation-and-repair", title: "Bathtub installation and repair", description: "Bathtub installation and repair" },
      { id: "bidet-spray-installation", title: "Bidet spray installation", description: "Bidet spray installation" },
      { id: "visible-pipe-leak-repair", title: "Visible pipe leak repair", description: "Visible pipe leak repair" },
      { id: "concealed-wall-pipe-leak-repair", title: "Concealed wall pipe leak repair", description: "Concealed wall pipe leak repair" },
      { id: "burst-pipe-emergency-repair", title: "Burst pipe emergency repair", description: "Burst pipe emergency repair" },
      { id: "pvc-and-cpvc-pipe-installation", title: "PVC and CPVC pipe installation", description: "PVC and CPVC pipe installation" },
      { id: "old-galvanized-or-copper-pipe-repair", title: "Old galvanized or copper pipe repair", description: "Old galvanized or copper pipe repair" },
      { id: "low-water-pressure-diagnosis", title: "Low water pressure diagnosis", description: "Low water pressure diagnosis" },
      { id: "booster-pump-installation", title: "Booster pump installation", description: "Booster pump installation" },
      { id: "overhead-water-tank-installation-and-cleaning", title: "Overhead water tank installation and cleaning", description: "Overhead water tank installation and cleaning" },
      { id: "underground-water-tank-installation-and-repair", title: "Underground water tank installation and repair", description: "Underground water tank installation and repair" },
      { id: "borehole-pump-installation-and-repair", title: "Borehole pump installation and repair", description: "Borehole pump installation and repair" },
      { id: "water-filtration-system-installation", title: "Water filtration system installation", description: "Water filtration system installation" },
      { id: "septic-tank-installation", title: "Septic tank installation", description: "Septic tank installation" },
      { id: "soakaway-construction-and-repair", title: "Soakaway construction and repair", description: "Soakaway construction and repair" },
      { id: "drainage-channel-and-gutter-clearing", title: "Drainage channel and gutter clearing", description: "Drainage channel and gutter clearing" },
      { id: "sewer-line-blockage-clearing", title: "Sewer line blockage clearing", description: "Sewer line blockage clearing" },
      { id: "water-heater-installation", title: "Water heater installation", description: "Water heater installation" },
      { id: "water-heater-repair", title: "Water heater repair", description: "Water heater repair" },
      { id: "instant-water-heater-installation", title: "Instant water heater installation", description: "Instant water heater installation" },
      { id: "cooking-gas-line-plumbing-connection", title: "Cooking gas line plumbing connection", description: "Cooking gas line plumbing connection" },
      { id: "washing-machine-plumbing-connection", title: "Washing machine plumbing connection", description: "Washing machine plumbing connection" },
      { id: "water-meter-installation-and-repair", title: "Water meter installation and repair", description: "Water meter installation and repair" },
      { id: "new-building-plumbing-rough-in", title: "New building plumbing rough-in", description: "New building plumbing rough-in" },
      { id: "swimming-pool-plumbing", title: "Swimming pool plumbing", description: "Swimming pool plumbing" }
    ]
  },
  "electrical-repairs-and-installation": {
    id: "electrical-repairs-and-installation",
    title: "Electrical Repairs and Installation",
    subServices: [
      { id: "full-house-wiring", title: "Full house wiring", description: "Full house wiring" },
      { id: "rewiring-of-old-or-faulty-wiring", title: "Rewiring of old or faulty wiring", description: "Rewiring of old or faulty wiring" },
      { id: "socket-and-outlet-installation", title: "Socket and outlet installation", description: "Socket and outlet installation" },
      { id: "light-switch-installation-and-repair", title: "Light switch installation and repair", description: "Light switch installation and repair" },
      { id: "light-fixture-installation", title: "Light fixture installation", description: "Light fixture installation" },
      { id: "ceiling-fan-installation-and-repair", title: "Ceiling fan installation and repair", description: "Ceiling fan installation and repair" },
      { id: "distribution-board-installation-and-repair", title: "Distribution board installation and repair", description: "Distribution board installation and repair" },
      { id: "fuse-box-to-circuit-breaker-upgrade", title: "Fuse box to circuit breaker upgrade", description: "Fuse box to circuit breaker upgrade" },
      { id: "earthing-and-grounding-installation", title: "Earthing and grounding installation", description: "Earthing and grounding installation" },
      { id: "short-circuit-diagnosis-and-repair", title: "Short circuit diagnosis and repair", description: "Short circuit diagnosis and repair" },
      { id: "frequent-breaker-tripping-diagnosis", title: "Frequent breaker tripping diagnosis", description: "Frequent breaker tripping diagnosis" },
      { id: "post-fire-electrical-rewiring", title: "Post-fire electrical rewiring", description: "Post-fire electrical rewiring" },
      { id: "surge-protection-installation", title: "Surge protection installation", description: "Surge protection installation" },
      { id: "automatic-voltage-regulator-installation-and-repair", title: "Automatic voltage regulator installation and repair", description: "Automatic voltage regulator installation and repair" },
      { id: "generator-automatic-transfer-switch-installation", title: "Generator automatic transfer switch installation", description: "Generator automatic transfer switch installation" },
      { id: "manual-generator-changeover-switch-installation", title: "Manual generator changeover switch installation", description: "Manual generator changeover switch installation" },
      { id: "generator-wiring-to-house-panel", title: "Generator wiring to house panel", description: "Generator wiring to house panel" },
      { id: "battery-inverter-system-installation", title: "Battery inverter system installation", description: "Battery inverter system installation" },
      { id: "solar-panel-installation", title: "Solar panel installation", description: "Solar panel installation" },
      { id: "solar-inverter-and-battery-wiring", title: "Solar inverter and battery wiring", description: "Solar inverter and battery wiring" },
      { id: "prepaid-meter-fault-diagnosis-and-disco-liaison", title: "Prepaid meter fault diagnosis and DISCO liaison", description: "Prepaid meter fault diagnosis and DISCO liaison" },
      { id: "dedicated-ac-circuit-installation", title: "Dedicated AC circuit installation", description: "Dedicated AC circuit installation" },
      { id: "water-heater-electrical-connection", title: "Water heater electrical connection", description: "Water heater electrical connection" },
      { id: "cooker-point-and-extractor-fan-wiring", title: "Cooker point and extractor fan wiring", description: "Cooker point and extractor fan wiring" },
      { id: "cctv-wiring-and-power-installation", title: "CCTV wiring and power installation", description: "CCTV wiring and power installation" },
      { id: "doorbell-and-intercom-wiring", title: "Doorbell and intercom wiring", description: "Doorbell and intercom wiring" },
      { id: "security-light-and-floodlight-installation", title: "Security light and floodlight installation", description: "Security light and floodlight installation" },
      { id: "underground-cable-installation", title: "Underground cable installation", description: "Underground cable installation" },
      { id: "general-electrical-fault-finding", title: "General electrical fault-finding", description: "General electrical fault-finding" },
      { id: "old-building-electrical-safety-inspection", title: "Old building electrical safety inspection", description: "Old building electrical safety inspection" },
      { id: "electric-fence-installation-and-repair", title: "Electric fence installation and repair", description: "Electric fence installation and repair" },
      { id: "compound-pole-light-installation", title: "Compound pole light installation", description: "Compound pole light installation" }
    ]
  },
  "air-conditioning-and-refrigeration": {
    id: "air-conditioning-and-refrigeration",
    title: "Air Conditioning and Refrigeration",
    subServices: [
      { id: "split-ac-installation", title: "Split AC installation", description: "Split AC installation" },
      { id: "window-ac-installation", title: "Window AC installation", description: "Window AC installation" },
      { id: "ac-servicing", title: "AC servicing", description: "AC servicing" },
      { id: "ac-gas-refill", title: "AC gas refill", description: "AC gas refill" },
      { id: "ac-compressor-repair", title: "AC compressor repair", description: "AC compressor repair" },
      { id: "ac-condensate-leak-repair", title: "AC condensate leak repair", description: "AC condensate leak repair" },
      { id: "central-or-ducted-ac-repair", title: "Central or ducted AC repair", description: "Central or ducted AC repair" },
      { id: "refrigerator-repair", title: "Refrigerator repair", description: "Refrigerator repair" },
      { id: "deep-freezer-repair", title: "Deep freezer repair", description: "Deep freezer repair" },
      { id: "water-dispenser-repair", title: "Water dispenser repair", description: "Water dispenser repair" }
    ]
  },
  "generator-repair-and-maintenance": {
    id: "generator-repair-and-maintenance",
    title: "Generator Repair and Maintenance",
    subServices: [
      { id: "routine-generator-servicing", title: "Routine generator servicing", description: "Routine generator servicing" },
      { id: "starting-and-ignition-fault-repair", title: "Starting and ignition fault repair", description: "Starting and ignition fault repair" },
      { id: "carburetor-cleaning-and-repair", title: "Carburetor cleaning and repair", description: "Carburetor cleaning and repair" },
      { id: "alternator-and-avr-repair", title: "Alternator and AVR repair", description: "Alternator and AVR repair" },
      { id: "engine-overhaul", title: "Engine overhaul", description: "Engine overhaul" },
      { id: "diesel-injector-pump-repair", title: "Diesel injector pump repair", description: "Diesel injector pump repair" },
      { id: "soundproof-canopy-fabrication", title: "Soundproof canopy fabrication", description: "Soundproof canopy fabrication" },
      { id: "remote-start-installation", title: "Remote start installation", description: "Remote start installation" },
      { id: "generator-relocation-and-mounting", title: "Generator relocation and mounting", description: "Generator relocation and mounting" }
    ]
  },
  "carpentry-and-woodwork": {
    id: "carpentry-and-woodwork",
    title: "Carpentry and Woodwork",
    subServices: [
      { id: "door-installation-and-repair", title: "Door installation and repair", description: "Door installation and repair" },
      { id: "window-frame-carpentry", title: "Window frame carpentry", description: "Window frame carpentry" },
      { id: "wardrobe-installation-and-repair", title: "Wardrobe installation and repair", description: "Wardrobe installation and repair" },
      { id: "kitchen-cabinet-installation-and-repair", title: "Kitchen cabinet installation and repair", description: "Kitchen cabinet installation and repair" },
      { id: "custom-furniture-making", title: "Custom furniture making", description: "Custom furniture making" },
      { id: "furniture-repair", title: "Furniture repair", description: "Furniture repair" },
      { id: "false-ceiling-timber-framing", title: "False ceiling timber framing", description: "False ceiling timber framing" },
      { id: "roof-timber-truss-carpentry", title: "Roof timber truss carpentry", description: "Roof timber truss carpentry" },
      { id: "door-lock-and-handle-fitting", title: "Door lock and handle fitting", description: "Door lock and handle fitting" },
      { id: "wood-flooring-installation-and-repair", title: "Wood flooring installation and repair", description: "Wood flooring installation and repair" },
      { id: "staircase-construction-and-repair", title: "Staircase construction and repair", description: "Staircase construction and repair" },
      { id: "fence-gate-woodwork", title: "Fence gate woodwork", description: "Fence gate woodwork" },
      { id: "wood-polishing-and-varnishing", title: "Wood polishing and varnishing", description: "Wood polishing and varnishing" },
      { id: "upholstery-frame-repair", title: "Upholstery frame repair", description: "Upholstery frame repair" }
    ]
  },
  "masonry-tiling-and-building-finishing": {
    id: "masonry-tiling-and-building-finishing",
    title: "Masonry, Tiling, and Building Finishing",
    subServices: [
      { id: "blockwork-and-bricklaying", title: "Blockwork and bricklaying", description: "Blockwork and bricklaying" },
      { id: "wall-plastering", title: "Wall plastering", description: "Wall plastering" },
      { id: "floor-tiling", title: "Floor tiling", description: "Floor tiling" },
      { id: "wall-tiling", title: "Wall tiling", description: "Wall tiling" },
      { id: "tile-regrouting-and-replacement", title: "Tile regrouting and replacement", description: "Tile regrouting and replacement" },
      { id: "terrazzo-flooring-installation-and-repair", title: "Terrazzo flooring installation and repair", description: "Terrazzo flooring installation and repair" },
      { id: "screeding", title: "Screeding", description: "Screeding" },
      { id: "concrete-casting-and-pouring", title: "Concrete casting and pouring", description: "Concrete casting and pouring" },
      { id: "damp-proofing-and-waterproofing", title: "Damp-proofing and waterproofing", description: "Damp-proofing and waterproofing" },
      { id: "structural-crack-repair", title: "Structural crack repair", description: "Structural crack repair" },
      { id: "pop-ceiling-design-and-installation", title: "POP ceiling design and installation", description: "POP ceiling design and installation" },
      { id: "pop-ceiling-repair", title: "POP ceiling repair", description: "POP ceiling repair" },
      { id: "cornice-and-molding-installation", title: "Cornice and molding installation", description: "Cornice and molding installation" }
    ]
  },
  "painting-and-decoration": {
    id: "painting-and-decoration",
    title: "Painting and Decoration",
    subServices: [
      { id: "interior-wall-painting", title: "Interior wall painting", description: "Interior wall painting" },
      { id: "exterior-wall-painting", title: "Exterior wall painting", description: "Exterior wall painting" },
      { id: "weatherproof-exterior-coating", title: "Weatherproof exterior coating", description: "Weatherproof exterior coating" },
      { id: "textured-decorative-wall-finishes", title: "Textured decorative wall finishes", description: "Textured decorative wall finishes" },
      { id: "wallpaper-installation-and-removal", title: "Wallpaper installation and removal", description: "Wallpaper installation and removal" },
      { id: "wood-staining-and-varnishing", title: "Wood staining and varnishing", description: "Wood staining and varnishing" },
      { id: "metal-gate-anti-rust-painting", title: "Metal gate anti-rust painting", description: "Metal gate anti-rust painting" },
      { id: "signage-and-lettering-painting", title: "Signage and lettering painting", description: "Signage and lettering painting" }
    ]
  },
  "welding-and-metal-fabrication": {
    id: "welding-and-metal-fabrication",
    title: "Welding and Metal Fabrication",
    subServices: [
      { id: "burglary-proof-window-guard-fabrication", title: "Burglary-proof window guard fabrication", description: "Burglary-proof window guard fabrication" },
      { id: "metal-gate-fabrication", title: "Metal gate fabrication", description: "Metal gate fabrication" },
      { id: "perimeter-fence-railing-fabrication", title: "Perimeter fence railing fabrication", description: "Perimeter fence railing fabrication" },
      { id: "staircase-handrail-fabrication", title: "Staircase handrail fabrication", description: "Staircase handrail fabrication" },
      { id: "metal-door-fabrication", title: "Metal door fabrication", description: "Metal door fabrication" },
      { id: "carport-and-shade-fabrication", title: "Carport and shade fabrication", description: "Carport and shade fabrication" },
      { id: "water-tank-stand-fabrication", title: "Water tank stand fabrication", description: "Water tank stand fabrication" },
      { id: "roofing-ridge-cap-metalwork", title: "Roofing ridge cap metalwork", description: "Roofing ridge cap metalwork" },
      { id: "repair-welding-for-gates-and-furniture", title: "Repair welding for gates and furniture", description: "Repair welding for gates and furniture" }
    ]
  },
  "roofing": {
    id: "roofing",
    title: "Roofing",
    subServices: [
      { id: "roofing-sheet-installation", title: "Roofing sheet installation", description: "Roofing sheet installation" },
      { id: "roof-leak-detection-and-repair", title: "Roof leak detection and repair", description: "Roof leak detection and repair" },
      { id: "roof-truss-repair", title: "Roof truss repair", description: "Roof truss repair" },
      { id: "gutter-installation-and-repair", title: "Gutter installation and repair", description: "Gutter installation and repair" },
      { id: "ceiling-water-damage-repair", title: "Ceiling water damage repair", description: "Ceiling water damage repair" },
      { id: "ridge-cap-and-flashing-repair", title: "Ridge cap and flashing repair", description: "Ridge cap and flashing repair" }
    ]
  },
  "glazing-and-window-or-door-fitting": {
    id: "glazing-and-window-or-door-fitting",
    title: "Glazing and Window or Door Fitting",
    subServices: [
      { id: "window-glass-replacement", title: "Window glass replacement", description: "Window glass replacement" },
      { id: "sliding-door-and-window-track-repair", title: "Sliding door and window track repair", description: "Sliding door and window track repair" },
      { id: "aluminum-window-and-door-frame-installation", title: "Aluminum window and door frame installation", description: "Aluminum window and door frame installation" },
      { id: "mosquito-net-installation", title: "Mosquito net installation", description: "Mosquito net installation" },
      { id: "glass-shower-cubicle-installation", title: "Glass shower cubicle installation", description: "Glass shower cubicle installation" }
    ]
  },
  "locksmith-services": {
    id: "locksmith-services",
    title: "Locksmith Services",
    subServices: [
      { id: "door-lock-installation-and-repair", title: "Door lock installation and repair", description: "Door lock installation and repair" },
      { id: "padlock-and-gate-lock-repair", title: "Padlock and gate lock repair", description: "Padlock and gate lock repair" },
      { id: "key-cutting-and-duplication", title: "Key cutting and duplication", description: "Key cutting and duplication" },
      { id: "emergency-lockout-response", title: "Emergency lockout response", description: "Emergency lockout response" },
      { id: "safe-installation-and-repair", title: "Safe installation and repair", description: "Safe installation and repair" },
      { id: "digital-and-smart-lock-installation", title: "Digital and smart lock installation", description: "Digital and smart lock installation" }
    ]
  },
  "gas-technician-services": {
    id: "gas-technician-services",
    title: "Gas Technician Services",
    subServices: [
      { id: "cooking-gas-leak-detection", title: "Cooking gas leak detection", description: "Cooking gas leak detection" },
      { id: "gas-cooker-installation-and-repair", title: "Gas cooker installation and repair", description: "Gas cooker installation and repair" },
      { id: "gas-regulator-replacement", title: "Gas regulator replacement", description: "Gas regulator replacement" },
      { id: "piped-gas-line-installation", title: "Piped gas line installation", description: "Piped gas line installation" }
    ]
  },
  "home-appliance-repair": {
    id: "home-appliance-repair",
    title: "Home Appliance Repair",
    subServices: [
      { id: "washing-machine-repair", title: "Washing machine repair", description: "Washing machine repair" },
      { id: "microwave-repair", title: "Microwave repair", description: "Microwave repair" },
      { id: "blender-and-mixer-repair", title: "Blender and mixer repair", description: "Blender and mixer repair" },
      { id: "electric-kettle-and-iron-repair", title: "Electric kettle and iron repair", description: "Electric kettle and iron repair" },
      { id: "television-repair", title: "Television repair", description: "Television repair" },
      { id: "home-theatre-repair", title: "Home theatre repair", description: "Home theatre repair" },
      { id: "voltage-stabilizer-repair", title: "Voltage stabilizer repair", description: "Voltage stabilizer repair" },
      { id: "ups-repair", title: "UPS repair", description: "UPS repair" }
    ]
  },
  "security-and-smart-home-installation": {
    id: "security-and-smart-home-installation",
    title: "Security and Smart Home Installation",
    subServices: [
      { id: "cctv-installation", title: "CCTV installation", description: "CCTV installation" },
      { id: "burglar-alarm-installation", title: "Burglar alarm installation", description: "Burglar alarm installation" },
      { id: "intercom-installation", title: "Intercom installation", description: "Intercom installation" },
      { id: "electric-fence-installation", title: "Electric fence installation", description: "Electric fence installation" },
      { id: "smart-home-device-installation", title: "Smart home device installation", description: "Smart home device installation" },
      { id: "satellite-dish-installation", title: "Satellite dish installation", description: "Satellite dish installation" },
      { id: "wi-fi-and-network-cabling", title: "Wi-Fi and network cabling", description: "Wi-Fi and network cabling" }
    ]
  },
  "cleaning-fumigation-and-pest-control": {
    id: "cleaning-fumigation-and-pest-control",
    title: "Cleaning, Fumigation, and Pest Control",
    subServices: [
      { id: "post-construction-cleaning", title: "Post-construction cleaning", description: "Post-construction cleaning" },
      { id: "recurring-home-or-office-cleaning", title: "Recurring home or office cleaning", description: "Recurring home or office cleaning" },
      { id: "upholstery-and-carpet-cleaning", title: "Upholstery and carpet cleaning", description: "Upholstery and carpet cleaning" },
      { id: "cockroach-and-bedbug-fumigation", title: "Cockroach and bedbug fumigation", description: "Cockroach and bedbug fumigation" },
      { id: "rodent-control", title: "Rodent control", description: "Rodent control" },
      { id: "termite-treatment", title: "Termite treatment", description: "Termite treatment" },
      { id: "mosquito-fogging", title: "Mosquito fogging", description: "Mosquito fogging" },
      { id: "water-tank-cleaning", title: "Water tank cleaning", description: "Water tank cleaning" },
      { id: "septic-tank-pumping", title: "Septic tank pumping", description: "Septic tank pumping" }
    ]
  },
  "gardening-and-landscaping": {
    id: "gardening-and-landscaping",
    title: "Gardening and Landscaping",
    subServices: [
      { id: "lawn-mowing-and-maintenance", title: "Lawn mowing and maintenance", description: "Lawn mowing and maintenance" },
      { id: "hedge-trimming", title: "Hedge trimming", description: "Hedge trimming" },
      { id: "tree-felling-and-pruning", title: "Tree felling and pruning", description: "Tree felling and pruning" },
      { id: "landscape-design-and-planting", title: "Landscape design and planting", description: "Landscape design and planting" },
      { id: "irrigation-system-installation", title: "Irrigation system installation", description: "Irrigation system installation" }
    ]
  },
  "tailoring-and-fashion": {
    id: "tailoring-and-fashion",
    title: "Tailoring and Fashion",
    subServices: [
      { id: "made-to-measure-clothing", title: "Made-to-measure clothing", description: "Made-to-measure clothing" },
      { id: "clothing-alterations", title: "Clothing alterations", description: "Clothing alterations" },
      { id: "school-uniform-sewing", title: "School uniform sewing", description: "School uniform sewing" },
      { id: "curtain-and-upholstery-sewing", title: "Curtain and upholstery sewing", description: "Curtain and upholstery sewing" },
      { id: "embroidery-and-ankara-styling", title: "Embroidery and Ankara styling", description: "Embroidery and Ankara styling" }
    ]
  },
  "hairdressing-and-barbing": {
    id: "hairdressing-and-barbing",
    title: "Hairdressing and Barbing",
    subServices: [
      { id: "barbing", title: "Barbing", description: "Barbing" },
      { id: "hair-styling-and-braiding", title: "Hair styling and braiding", description: "Hair styling and braiding" },
      { id: "wig-making-and-installation", title: "Wig making and installation", description: "Wig making and installation" },
      { id: "makeup-artistry", title: "Makeup artistry", description: "Makeup artistry" }
    ]
  },
  "laundry-and-dry-cleaning": {
    id: "laundry-and-dry-cleaning",
    title: "Laundry and Dry Cleaning",
    subServices: [
      { id: "wash-and-iron-service", title: "Wash and iron service", description: "Wash and iron service" },
      { id: "dry-cleaning", title: "Dry cleaning", description: "Dry cleaning" },
      { id: "ironing-and-pressing-only", title: "Ironing and pressing only", description: "Ironing and pressing only" }
    ]
  },
  "automobile-services": {
    id: "automobile-services",
    title: "Automobile Services",
    subServices: [
      { id: "auto-mechanic-engine-repair", title: "Auto mechanic engine repair", description: "Auto mechanic engine repair" },
      { id: "auto-electrician-work", title: "Auto electrician work", description: "Auto electrician work" },
      { id: "panel-beating", title: "Panel beating", description: "Panel beating" },
      { id: "auto-painting-and-spraying", title: "Auto painting and spraying", description: "Auto painting and spraying" },
      { id: "vulcanizing", title: "Vulcanizing", description: "Vulcanizing" },
      { id: "car-wash", title: "Car wash", description: "Car wash" },
      { id: "vehicle-ac-repair", title: "Vehicle AC repair", description: "Vehicle AC repair" }
    ]
  },
  "phone-and-electronics-repair": {
    id: "phone-and-electronics-repair",
    title: "Phone and Electronics Repair",
    subServices: [
      { id: "phone-screen-replacement", title: "Phone screen replacement", description: "Phone screen replacement" },
      { id: "phone-battery-replacement", title: "Phone battery replacement", description: "Phone battery replacement" },
      { id: "phone-software-troubleshooting", title: "Phone software troubleshooting", description: "Phone software troubleshooting" },
      { id: "laptop-hardware-repair", title: "Laptop hardware repair", description: "Laptop hardware repair" },
      { id: "computer-software-troubleshooting", title: "Computer software troubleshooting", description: "Computer software troubleshooting" },
      { id: "printer-repair", title: "Printer repair", description: "Printer repair" }
    ]
  },
  "shoe-and-leather-repair": {
    id: "shoe-and-leather-repair",
    title: "Shoe and Leather Repair",
    subServices: [
      { id: "shoe-sole-repair", title: "Shoe sole repair", description: "Shoe sole repair" },
      { id: "bag-repair", title: "Bag repair", description: "Bag repair" },
      { id: "leather-polishing", title: "Leather polishing", description: "Leather polishing" }
    ]
  },
  "event-and-catering-services": {
    id: "event-and-catering-services",
    title: "Event and Catering Services",
    subServices: [
      { id: "event-decoration", title: "Event decoration", description: "Event decoration" },
      { id: "catering", title: "Catering", description: "Catering" },
      { id: "photography-and-videography", title: "Photography and videography", description: "Photography and videography" },
      { id: "dj-and-sound-equipment-rental", title: "DJ and sound equipment rental", description: "DJ and sound equipment rental" },
      { id: "canopy-and-chair-rental", title: "Canopy and chair rental", description: "Canopy and chair rental" }
    ]
  },
  "construction-adjacent-trades": {
    id: "construction-adjacent-trades",
    title: "Construction-Adjacent Trades",
    subServices: [
      { id: "scaffolding-erection", title: "Scaffolding erection", description: "Scaffolding erection" },
      { id: "borehole-drilling", title: "Borehole drilling", description: "Borehole drilling" },
      { id: "interior-decoration-consultation", title: "Interior decoration consultation", description: "Interior decoration consultation" },
      { id: "land-survey-and-site-measurement", title: "Land survey and site measurement", description: "Land survey and site measurement" }
    ]
  }
};
