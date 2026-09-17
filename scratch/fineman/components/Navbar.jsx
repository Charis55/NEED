import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Utensils, 
  Dumbbell, 
  Trophy, 
  Map as MapIcon,
  User
} from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="bottom-nav glass-card">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ flex: 1, minWidth: 0 }}>
        <Home size={20} />
        <span className="responsive-text-hide">Home</span>
      </NavLink>
      <NavLink to="/meals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ flex: 1, minWidth: 0 }}>
        <Utensils size={20} />
        <span className="responsive-text-hide">Meals</span>
      </NavLink>
      <NavLink to="/workouts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ flex: 1, minWidth: 0 }}>
        <Dumbbell size={20} />
        <span className="responsive-text-hide">Workouts</span>
      </NavLink>
      <NavLink to="/leaderboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ flex: 1, minWidth: 0 }}>
        <Trophy size={20} />
        <span className="responsive-text-hide">Cup</span>
      </NavLink>
      <NavLink to="/campus" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ flex: 1, minWidth: 0 }}>
        <MapIcon size={20} />
        <span className="responsive-text-hide">Map</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ flex: 1, minWidth: 0 }}>
        <User size={20} />
        <span className="responsive-text-hide">Me</span>
      </NavLink>
    </nav>
  );
};

export default Navbar;
