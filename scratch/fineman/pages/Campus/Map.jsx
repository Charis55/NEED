import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Navigation, Target } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─────────────────────────────────────────────────────────────────────────────
// MAP MARKERS — 14 precise GPS-verified coordinates (do not alter)
// These are the ONLY markers shown on the live Leaflet map.
// ─────────────────────────────────────────────────────────────────────────────
const MAP_MARKERS = [
  { id: 1, name: 'Babcock University Stadium', type: 'sports', lat: 6.89472, lng: 3.72771, icon: '🏟️' },
  { id: 2, name: 'Babcock University Shopping Complex', type: 'food', lat: 6.8912, lng: 3.7205, icon: '🛍️' },
  { id: 3, name: 'Wema Bank (Babcock Branch)', type: 'amenity', lat: 6.8909, lng: 3.7208, icon: '🏦' },
  { id: 2, name: 'Main Gate', type: 'social', lat: 6.88908, lng: 3.72004, icon: '🏛️' },
  { id: 3, name: 'Teaching Hospital', type: 'social', lat: 6.8911, lng: 3.7173, icon: '🏥' },
  { id: 5, name: 'Neal C. Wilson Hall', type: 'social', lat: 6.89305, lng: 3.72172, icon: '🏠' },
  { id: 7, name: 'School of Computing & Engineering', type: 'academic', lat: 6.8904, lng: 3.7232, icon: '💻' },
  { id: 8, name: 'Babcock University Main Campus', type: 'academic', lat: 6.8924, lng: 3.7183, icon: '🌐' },
  { id: 9, name: 'Babcock Basketball Court', type: 'sports', lat: 6.89396, lng: 3.72848, icon: '🏀' },
  { id: 10, name: 'Babcock Amphitheatre', type: 'sports', lat: 6.8909, lng: 3.7226, icon: '🎭' },
  { id: 11, name: 'Babcock Food Service', type: 'food', lat: 6.89305, lng: 3.72277, icon: '🍛' },
  { id: 12, name: 'Babcock University Bakery', type: 'food', lat: 6.8928, lng: 3.7196, icon: '🥖' },
  { id: 13, name: 'Babcock Business School (BBS)', type: 'academic', lat: 6.8907, lng: 3.7237, icon: '📊' },
  { id: 14, name: 'Access Bank (Babcock Branch)', type: 'amenity', lat: 6.89078, lng: 3.72069, icon: '🏦' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ALL 56 DIRECTORY LOCATIONS — shown in the searchable list below the map.
// mapMarkerId links to a MAP_MARKERS entry for map centering (null = list-only).
// ─────────────────────────────────────────────────────────────────────────────
const ALL_LOCATIONS = [

  // ── 🏟️ Sports & Leisure ──
  { id: 'l1', name: 'Babcock University Stadium', type: 'sports', icon: '🏟️', desc: 'Main athletics and football arena on the north-east side of campus.', mapMarkerId: 1, lat: 6.8949, lng: 3.7276 },
  { id: 'l2', name: 'Sports Complex & Gymnasium', type: 'sports', icon: '🏋️', desc: 'Indoor gymnasium and multi-sport recreation facility.', mapMarkerId: null, lat: 6.8945, lng: 3.7265 },
  { id: 'l3', name: 'Emerald Activity Hall', type: 'sports', icon: '🟢', desc: 'Multi-purpose activity hall for indoor sports and recreation.', mapMarkerId: null, lat: 6.8935, lng: 3.7255 },
  { id: 'l4', name: 'Babcock Amphitheatre', type: 'sports', icon: '🎭', desc: 'Open-air theatre for performances, events and campus leisure.', mapMarkerId: 10, lat: 6.8909, lng: 3.7226 },

  // ── 🍔 Food & Dining ──
  { id: 'l5', name: 'Babcock Shopping Complex', type: 'food', icon: '🛍️', desc: 'Central shopping and dining complex at the heart of campus.', mapMarkerId: 2, lat: 6.8912, lng: 3.7205 },
  { id: 'l6', name: 'Tuck Shops & Snack Kiosks', type: 'food', icon: '🥪', desc: 'Scattered tuck-shop kiosks across the residential zones.', mapMarkerId: null, lat: 6.8920, lng: 3.7215 },
  { id: 'l7', name: 'Busa Food Court', type: 'food', icon: '🍽️', desc: 'BUSA-managed food court serving hot meals and snacks daily.', mapMarkerId: null, lat: 6.8921, lng: 3.7238 },
  { id: 'l8', name: 'Babcock Mini-Market', type: 'food', icon: '🛒', desc: 'Convenience mini-market stocking groceries and daily essentials.', mapMarkerId: null, lat: 6.8915, lng: 3.7200 },
  { id: 'l9', name: 'Babcock Bakery', type: 'food', icon: '🥖', desc: 'Campus bakery producing fresh bread, pastries and snacks daily.', mapMarkerId: 12, lat: 6.8928, lng: 3.7196 },

  // ── 🏦 Banks & Amenities ──
  { id: 'l10', name: 'Wema Bank (Babcock Branch)', type: 'amenity', icon: '🏦', desc: 'Full-service Wema Bank branch serving the Babcock community.', mapMarkerId: 3, lat: 6.8909, lng: 3.7208 },
  { id: 'l11', name: 'Access Bank (Babcock Branch)', type: 'amenity', icon: '🏦', desc: 'Access Bank branch located south of the Shopping Complex.', mapMarkerId: 14, lat: 6.89078, lng: 3.72069 },
  { id: 'l12', name: 'UBA Cash Center', type: 'amenity', icon: '💳', desc: 'United Bank for Africa ATM and cash center on campus.', mapMarkerId: null, lat: 6.8910, lng: 3.7206 },

  // ── 📚 Academic & Faculties ──
  { id: 'l13', name: 'Laz Otti Library', type: 'academic', icon: '📚', desc: 'Central academic library — study halls, digital resources and research.', mapMarkerId: 4, lat: 6.8923, lng: 3.7225 },
  { id: 'l14', name: 'Babcock Business School (BBS)', type: 'academic', icon: '📊', desc: 'Faculty of management and business sciences (BBS).', mapMarkerId: 13, lat: 6.8907, lng: 3.7237 },
  { id: 'l15', name: 'CILTRA (Languages Institute)', type: 'academic', icon: '🗣️', desc: 'Centre for International Languages Training and Research.', mapMarkerId: null, lat: 6.8915, lng: 3.7230 },
  { id: 'l16', name: 'School of Computing (EAH)', type: 'academic', icon: '💻', desc: 'School of Computing & Engineering Sciences — EAH building.', mapMarkerId: 7, lat: 6.8904, lng: 3.7232 },
  { id: 'l17', name: 'School of Law & Security Studies', type: 'academic', icon: '⚖️', desc: 'Faculty of law, criminology and security studies.', mapMarkerId: null, lat: 6.8900, lng: 3.7235 },
  { id: 'l18', name: 'School of Nursing Science', type: 'academic', icon: '🩺', desc: 'Faculty of nursing and health-related professional sciences.', mapMarkerId: null, lat: 6.8905, lng: 3.7228 },
  { id: 'l19', name: 'School of Public Health', type: 'academic', icon: '🌍', desc: 'Faculty of public health, epidemiology and community medicine.', mapMarkerId: null, lat: 6.8903, lng: 3.7225 },
  { id: 'l20', name: 'School of Science & Tech (SAT)', type: 'academic', icon: '🔬', desc: 'School of Science and Technology laboratory complex.', mapMarkerId: null, lat: 6.88872, lng: 3.72255 },
  { id: 'l21', name: 'School of Engineering', type: 'academic', icon: '⚙️', desc: 'Faculty of engineering, covering civil, mechanical and electrical.', mapMarkerId: null, lat: 6.8906, lng: 3.7238 },
  { id: 'l22', name: 'School of Education & Humanities', type: 'academic', icon: '🎓', desc: 'Faculty of education, arts and humanities.', mapMarkerId: null, lat: 6.8900, lng: 3.7230 },
  { id: 'l23', name: 'College of Postgraduate Studies', type: 'academic', icon: '🏫', desc: 'Postgraduate admissions, programmes and administrative offices.', mapMarkerId: null, lat: 6.8895, lng: 3.7225 },
  { id: 'l24', name: '600-Seater Auditorium', type: 'academic', icon: '🎤', desc: 'Large-capacity lecture and event auditorium on the main campus.', mapMarkerId: null, lat: 6.8930, lng: 3.7220 },
  { id: 'l25', name: 'Babcock University High School', type: 'academic', icon: '🏫', desc: 'BU-affiliated high school at the southern end of campus.', mapMarkerId: null, lat: 6.89011, lng: 3.71897 },

  // ── 🛏️ Residential Halls — Male Undergraduate ──
  { id: 'l26', name: 'Emerald Hall', type: 'residential', icon: '🟢', desc: 'Male undergraduate residential hall — Emerald block.', mapMarkerId: null, lat: 6.8937, lng: 3.71999 },
  { id: 'l27', name: 'Topaz Hall', type: 'residential', icon: '🔵', desc: 'Male undergraduate residential hall — Topaz block.', mapMarkerId: null, lat: 6.89346, lng: 3.72061 },
  { id: 'l28', name: 'Neal C. Wilson Hall', type: 'residential', icon: '🏠', desc: 'Male undergraduate residential hall — Neal C. Wilson block.', mapMarkerId: null, lat: 6.89305, lng: 3.72172 },
  { id: 'l29', name: 'Winslow Hall', type: 'residential', icon: '🏠', desc: 'Male undergraduate residential hall — Winslow block.', mapMarkerId: null, lat: 6.89401, lng: 3.72166 },
  { id: 'l30', name: 'Samuel Akande Hall', type: 'residential', icon: '🏠', desc: 'Male undergraduate residential hall — Samuel Akande block.', mapMarkerId: null, lat: 6.89413, lng: 3.72364 },
  { id: 'l31', name: 'Nelson Mandela Hall', type: 'residential', icon: '🏠', desc: 'Male undergraduate residential hall — Nelson Mandela block.', mapMarkerId: null, lat: 6.89347, lng: 3.72304 },
  { id: 'l32', name: 'Bethel Splendour Hall', type: 'residential', icon: '🏠', desc: 'Male undergraduate residential hall — Bethel Splendour block.', mapMarkerId: null, lat: 6.89461, lng: 3.72307 },
  { id: 'l33', name: 'Gideon Troopers Hall', type: 'residential', icon: '🏠', desc: 'Male undergraduate residential hall — Gideon Troopers block.', mapMarkerId: null, lat: 6.89442, lng: 3.72249 },

  // ── 🎓 Residential Halls — Postgraduate ──
  { id: 'l34', name: 'Adeleke Hall (Male PG)', type: 'residential', icon: '🎓', desc: 'Male postgraduate residential hall — Adeleke block.', mapMarkerId: null, lat: 6.8928, lng: 3.72115 },
  { id: 'l35', name: 'Justice Hall (Male PG)', type: 'residential', icon: '🎓', desc: 'Male postgraduate residential hall — Justice block.', mapMarkerId: null, lat: 6.8945, lng: 3.7265 },
  { id: 'l36', name: 'Peace Hall (Male PG)', type: 'residential', icon: '🎓', desc: 'Male postgraduate residential hall — Peace block.', mapMarkerId: null, lat: 6.8888, lng: 3.7215 },
  { id: 'l37', name: 'Maranatha Hall (Female PG)', type: 'residential', icon: '🎓', desc: 'Female postgraduate residential hall — Maranatha block.', mapMarkerId: null, lat: 6.8921, lng: 3.7258 },

  // ── 🛏️ Residential Halls — Female Undergraduate ──
  { id: 'l38', name: 'Ameyo Adadevh Hall', type: 'residential', icon: '🌸', desc: 'Female undergraduate residential hall — Ameyo Adadevh block.', mapMarkerId: null, lat: 6.89494, lng: 3.72493 },
  { id: 'l39', name: 'Welch Hall', type: 'residential', icon: '🌸', desc: 'Female undergraduate residential hall — Welch block.', mapMarkerId: null, lat: 6.89175, lng: 3.72144 },
  { id: 'l40', name: 'Diamond Hall', type: 'residential', icon: '💎', desc: 'Female undergraduate residential hall — Diamond block.', mapMarkerId: null, lat: 6.89212, lng: 3.72719 },
  { id: 'l41', name: 'Crystal Hall', type: 'residential', icon: '🔷', desc: 'Female undergraduate residential hall — Crystal block.', mapMarkerId: null, lat: 6.89286, lng: 3.72774 },
  { id: 'l42', name: 'Platinum Hall', type: 'residential', icon: '⬜', desc: 'Female undergraduate residential hall — Platinum block.', mapMarkerId: null, lat: 6.89245, lng: 3.72742 },
  { id: 'l43', name: 'FAD Hall (Felicia Adebisi)', type: 'residential', icon: '🌸', desc: 'Female undergraduate residential hall — FAD block.', mapMarkerId: null, lat: 6.89367, lng: 3.72498 },
  { id: 'l44', name: 'Sapphire Hall', type: 'residential', icon: '🔹', desc: 'Female undergraduate residential hall — Sapphire block.', mapMarkerId: null, lat: 6.8960, lng: 3.7215 },
  { id: 'l45', name: 'Nyberg Hall', type: 'residential', icon: '🌸', desc: 'Female undergraduate residential hall — Nyberg block.', mapMarkerId: null, lat: 6.8926, lng: 3.72538 },
  { id: 'l46', name: 'White Hall', type: 'residential', icon: '🏳️', desc: 'Female undergraduate residential hall — White block.', mapMarkerId: null, lat: 6.89377, lng: 3.72633 },
  { id: 'l47', name: 'Queen Esther Hall', type: 'residential', icon: '👑', desc: 'Female undergraduate residential hall — Queen Esther block.', mapMarkerId: null, lat: 6.89298, lng: 3.7247 },
  { id: 'l48', name: 'Havilah Gold Hall', type: 'residential', icon: '✨', desc: 'Female undergraduate residential hall — Havilah Gold block.', mapMarkerId: null, lat: 6.89488, lng: 3.72607 },

  // ── 🏥 Health & Medical ──
  { id: 'l49', name: 'Babcock Teaching Hospital (BUTH)', type: 'health', icon: '🏥', desc: 'Premier university teaching hospital — full specialist care.', mapMarkerId: 5, lat: 6.8911, lng: 3.7173 },
  { id: 'l50', name: 'BUTH Cardiac Centre', type: 'health', icon: '❤️', desc: 'Specialised cardiac unit within the teaching hospital complex.', mapMarkerId: null, lat: 6.8908, lng: 3.7170 },
  { id: 'l51', name: 'Medical Diagnostics Center', type: 'health', icon: '🔬', desc: 'Diagnostic imaging, labs and pathology services at BUTH.', mapMarkerId: null, lat: 6.8910, lng: 3.7168 },
  { id: 'l52', name: 'OBGyn Clinic', type: 'health', icon: '🤱', desc: 'Obstetrics and gynaecology outpatient clinic at BUTH.', mapMarkerId: null, lat: 6.8912, lng: 3.7168 },
  { id: 'l53', name: 'Student Medical Center (SMC)', type: 'health', icon: '💊', desc: 'On-campus student clinic for routine health care and emergencies.', mapMarkerId: null, lat: 6.8920, lng: 3.7175 },
  { id: 'l54', name: 'BUTH Eye Clinic / Optometry', type: 'health', icon: '👁️', desc: 'Eye care and optometry services at the teaching hospital.', mapMarkerId: null, lat: 6.8906, lng: 3.7172 },
  { id: 'l55', name: 'BUTH Dental Centre', type: 'health', icon: '🦷', desc: 'Dental clinic offering full oral health and orthodontic services.', mapMarkerId: null, lat: 6.8914, lng: 3.7170 },

  // ── ⛪ Worship Centres ──
  { id: 'l56', name: 'Dominion Chapel', type: 'worship', icon: '⛪', desc: 'Main campus chapel — home of Dominion worship services.', mapMarkerId: null, lat: 6.8930, lng: 3.7190 },
  { id: 'l57', name: 'Pioneer SDA Church', type: 'worship', icon: '🕍', desc: 'Seventh-day Adventist pioneer church on campus.', mapMarkerId: null, lat: 6.88961, lng: 3.7196 },

  // ── 🏛️ Admin & Services ──
  { id: 'l58', name: 'Babcock University Registry', type: 'admin', icon: '🏛️', desc: 'Central registry — student records, transcripts and official admin.', mapMarkerId: 6, lat: 6.8893, lng: 3.7218 },
  { id: 'l59', name: 'Babcock Security Office', type: 'admin', icon: '🔐', desc: 'Campus security command centre and emergency response unit.', mapMarkerId: null, lat: 6.8900, lng: 3.7175 },
  { id: 'l60', name: 'BUSA House (Student Assoc.)', type: 'admin', icon: '🏠', desc: 'Babcock University Student Association offices and meeting rooms.', mapMarkerId: null, lat: 6.89205, lng: 3.72376 },
  { id: 'l61', name: 'Babcock Guest House', type: 'admin', icon: '🛎️', desc: 'Official university guest accommodation and conference facilities.', mapMarkerId: null, lat: 6.89051, lng: 3.71992 },
  { id: 'l62', name: 'Alumni Building', type: 'admin', icon: '🎓', desc: 'Alumni relations offices, networking lounge and events venue.', mapMarkerId: null, lat: 6.8915, lng: 3.7185 },
  { id: 'l63', name: 'Post Office & Mail Room', type: 'admin', icon: '📬', desc: 'Campus postal service for student parcels, mail and courier pickup.', mapMarkerId: null, lat: 6.8910, lng: 3.7195 },
  { id: 'l64', name: 'BU Main Gate (Entrances)', type: 'admin', icon: '🚪', desc: 'Primary campus entry and exit points — staffed security checkpoints.', mapMarkerId: null, lat: 6.88908, lng: 3.72004 },
  { id: 'l65', name: 'Babcock Water Factory', type: 'admin', icon: '💧', desc: 'Campus-owned water treatment and bottling facility.', mapMarkerId: null, lat: 6.8885, lng: 3.7185 },
  { id: 'l66', name: 'Farm Office & Greenhouses', type: 'admin', icon: '🌱', desc: 'University farm management office, greenhouses and agric resources.', mapMarkerId: null, lat: 6.8870, lng: 3.7200 },
];

// (JOGGING_ROUTES imported from ../../data/jogRoutes)

// ─────────────────────────────────────────────────────────────────────────────
// Campus Boundary Coordinates — DO NOT ALTER
// ─────────────────────────────────────────────────────────────────────────────
const CAMPUS_BOUNDARY = [
  [6.8959, 3.7135],
  [6.8975, 3.7255],
  [6.8965, 3.7315],
  [6.8920, 3.7310],
  [6.8885, 3.7275],
  [6.8865, 3.7225],
  [6.8875, 3.7145],
  [6.8925, 3.7130],
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'academic', label: 'Academic', icon: '📚' },
  { id: 'residential', label: 'Residential', icon: '🏠' },
  { id: 'food', label: 'Food', icon: '🍔' },
  { id: 'health', label: 'Health', icon: '🏥' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'amenity', label: 'Amenities', icon: '🏦' },
  { id: 'worship', label: 'Worship', icon: '⛪' },
  { id: 'admin', label: 'Admin', icon: '🏛️' },
];

// Custom component to handle map centering/zooming — DO NOT ALTER
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function CampusMap() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);

  // Filter the FULL 56-location list for the directory below the map
  const filteredLocations = useMemo(() => {
    return ALL_LOCATIONS.filter(place => {
      const matchesCategory = activeCategory === 'all' || place.type === activeCategory;
      const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleGetDirections = (lat, lng) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const createCustomIcon = (icon) => L.divIcon({
    html: `<div class="custom-marker" style="width:32px;height:32px;font-size:16px;">${icon}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  // When a list card is clicked, try to find the matching MAP_MARKER to centre the map
  const handleCardClick = (place) => {
    if (place.mapMarkerId) {
      const marker = MAP_MARKERS.find(m => m.id === place.mapMarkerId);
      if (marker) setSelectedPlace(marker);
    } else {
      // Fly to the location's own coordinate even if no marker
      setSelectedPlace({ lat: place.lat, lng: place.lng });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-container campus-container flex flex-col gap-6 pb-24">

      {/* ══════════════════════════════════════════════════════════════════
          LIVE MAP — DO NOT ALTER THIS SECTION
          Map markers are driven by MAP_MARKERS (14 precise GPS pins).
      ══════════════════════════════════════════════════════════════════ */}
      <div className="map-view-container glass-panel overflow-hidden dark-map w-full"
        style={{ height: '55vh', minHeight: '400px', position: 'relative' }}>
        <MapContainer
          center={[6.8924, 3.7183]}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polygon
            positions={CAMPUS_BOUNDARY}
            pathOptions={{
              color: 'white', weight: 3, opacity: 0.8,
              fillColor: 'var(--accent-emerald)', fillOpacity: 0.05,
              dashArray: '5, 10',
            }}
          />

          {MAP_MARKERS.map(place => (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={createCustomIcon(place.icon)}
              eventHandlers={{ click: () => setSelectedPlace(place) }}
            >
              <Popup>
                <div className="p-2 marker-popup">
                  <h3 className="font-bold text-white mb-1" style={{ fontSize: '1rem' }}>{place.name}</h3>
                  <button
                    className="directions-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleGetDirections(place.lat, place.lng); }}
                  >
                    <Navigation size={14} /> <span>Get Directions</span>
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {selectedPlace && <ChangeView center={[selectedPlace.lat, selectedPlace.lng]} zoom={17} />}
        </MapContainer>

        <div className="absolute top-4 right-4 z-[1000]">
          <button
            className="p-3 glass-panel rounded-full text-white hover:text-emerald-400 transition-colors shadow-lg"
            onClick={() => setSelectedPlace({ lat: 6.8924, lng: 3.7183 })}
            title="Recenter Map"
          >
            <Target size={20} />
          </button>
        </div>
      </div>
      {/* ══════════════════════════════════════════════════════════════════
          END OF LIVE MAP — safe to edit below this line
      ══════════════════════════════════════════════════════════════════ */}

      {/* ── SEARCH & FILTER ── */}
      <div className="directory-header glass-panel">
        <div className="mb-5">
          <h1 className="text-glow text-2xl font-bold mb-1">Campus Directory</h1>
          <p className="text-secondary text-sm">Click Any Card To Pin It On The Map Above
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="search-bar-wrapper flex-1">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search all 56 locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="directory-search-input"
            />
          </div>

          <div className="flex gap-2 category-scroll-container overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`category-pill flex-shrink-0 ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── DIRECTORY LIST (all 56 locations) ── */}
      <div className="directory-results w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredLocations.map(place => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={place.id}
                className={`command-card h-full ${selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng ? 'active' : ''}`}
                onClick={() => handleCardClick(place)}
              >
                <div className="flex items-center justify-between gap-4 h-full">
                  <div className="flex items-center gap-4">
                    <div className={`command-icon-box ${place.type}`}>
                      {place.icon}
                      <div className="status-pulse"></div>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="command-title">{place.name}</h3>
                        <span className={`type-badge flex-shrink-0 ${place.type}`}>{place.type}</span>
                      </div>
                      <p className="command-desc line-clamp-2">{place.desc}</p>
                    </div>
                  </div>

                  <button
                    className="list-directions-btn"
                    onClick={(e) => { e.stopPropagation(); handleGetDirections(place.lat, place.lng); }}
                    title="Get Directions"
                  >
                    <Navigation size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredLocations.length === 0 && (
            <div className="col-span-full empty-state-small glass-panel text-center p-8 my-4">
              <p className="text-secondary opacity-50">No locations match your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
