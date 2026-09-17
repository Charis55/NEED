import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Utensils, ChevronLeft, X, Edit3, Check, Flame, Beef, Wheat, Droplets } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDailyLog, logUserMeal, calculateUserBiometrics, saveCustomFood, getCustomFoods } from '../../utils/db';
import ShareModal from '../../components/ShareModal';

const NIGERIAN_FOODS = [
  // Rice dishes
  { id: 1,  name: 'Jollof Rice', calories: 350, unit: 'serving', carbs: 52, protein: 8, fat: 12, category: 'Rice' },
  { id: 2,  name: 'Fried Rice', calories: 380, unit: 'serving', carbs: 48, protein: 10, fat: 16, category: 'Rice' },
  { id: 3,  name: 'White Rice & Stew', calories: 400, unit: 'serving', carbs: 55, protein: 7, fat: 14, category: 'Rice' },
  { id: 4,  name: 'Coconut Rice', calories: 370, unit: 'serving', carbs: 50, protein: 6, fat: 15, category: 'Rice' },
  { id: 5,  name: 'Ofada Rice & Sauce', calories: 420, unit: 'serving', carbs: 50, protein: 12, fat: 18, category: 'Rice' },

  // Swallow & Soups
  { id: 6,  name: 'Garri (Eba)', calories: 330, unit: 'medium wrap', carbs: 80, protein: 1, fat: 0, category: 'Swallow' },
  { id: 7,  name: 'Pounded Yam', calories: 250, unit: 'medium wrap', carbs: 60, protein: 2, fat: 0, category: 'Swallow' },
  { id: 8,  name: 'Amala', calories: 280, unit: 'medium wrap', carbs: 68, protein: 3, fat: 1, category: 'Swallow' },
  { id: 9,  name: 'Semovita', calories: 320, unit: 'medium wrap', carbs: 72, protein: 5, fat: 1, category: 'Swallow' },
  { id: 10, name: 'Fufu (Akpu)', calories: 270, unit: 'medium wrap', carbs: 65, protein: 1, fat: 0, category: 'Swallow' },
  { id: 11, name: 'Wheat Flour (Swallow)', calories: 300, unit: 'medium wrap', carbs: 60, protein: 10, fat: 2, category: 'Swallow' },
  { id: 12, name: 'Egusi Soup', calories: 300, unit: 'serving', carbs: 10, protein: 15, fat: 22, category: 'Soup' },
  { id: 13, name: 'Ogbono Soup', calories: 220, unit: 'serving', carbs: 8, protein: 12, fat: 16, category: 'Soup' },
  { id: 14, name: 'Efo Riro (Vegetable Soup)', calories: 180, unit: 'serving', carbs: 8, protein: 10, fat: 12, category: 'Soup' },
  { id: 15, name: 'Okra Soup', calories: 160, unit: 'serving', carbs: 10, protein: 8, fat: 10, category: 'Soup' },
  { id: 16, name: 'Pepper Soup', calories: 200, unit: 'serving', carbs: 5, protein: 20, fat: 10, category: 'Soup' },
  { id: 17, name: 'Edikaikong Soup', calories: 250, unit: 'serving', carbs: 6, protein: 14, fat: 18, category: 'Soup' },
  { id: 18, name: 'Afang Soup', calories: 230, unit: 'serving', carbs: 7, protein: 13, fat: 16, category: 'Soup' },
  { id: 19, name: 'Bitterleaf Soup', calories: 200, unit: 'serving', carbs: 6, protein: 12, fat: 14, category: 'Soup' },

  // Proteins
  { id: 20, name: 'Suya (Beef)', calories: 250, unit: 'stick', carbs: 2, protein: 28, fat: 15, category: 'Protein' },
  { id: 21, name: 'Grilled Chicken', calories: 220, unit: 'piece', carbs: 0, protein: 35, fat: 8, category: 'Protein' },
  { id: 22, name: 'Fried Fish', calories: 280, unit: 'piece', carbs: 8, protein: 25, fat: 16, category: 'Protein' },
  { id: 23, name: 'Boiled Egg', calories: 78, unit: 'egg', carbs: 1, protein: 6, fat: 5, category: 'Protein' },
  { id: 24, name: 'Moi Moi', calories: 150, unit: 'piece', carbs: 12, protein: 7, fat: 8, category: 'Protein' },
  { id: 25, name: 'Akara (Bean Cake)', calories: 130, unit: '3 balls', carbs: 14, protein: 6, fat: 6, category: 'Protein' },
  { id: 26, name: 'Nkwobi', calories: 350, unit: 'serving', carbs: 5, protein: 30, fat: 22, category: 'Protein' },
  { id: 27, name: 'Peppered Snail', calories: 180, unit: 'serving', carbs: 4, protein: 22, fat: 8, category: 'Protein' },

  // Snacks & Sides
  { id: 28, name: 'Plantain (Dodo)', calories: 180, unit: 'fried (large)', carbs: 25, protein: 1, fat: 8, category: 'Snacks' },
  { id: 29, name: 'Puff Puff', calories: 280, unit: '5 pieces', carbs: 42, protein: 4, fat: 10, category: 'Snacks' },
  { id: 30, name: 'Chin Chin', calories: 300, unit: 'cup', carbs: 38, protein: 5, fat: 14, category: 'Snacks' },
  { id: 31, name: 'Meat Pie', calories: 320, unit: 'piece', carbs: 30, protein: 10, fat: 18, category: 'Snacks' },
  { id: 32, name: 'Sausage Roll', calories: 250, unit: 'piece', carbs: 22, protein: 8, fat: 14, category: 'Snacks' },
  { id: 33, name: 'Scotch Egg', calories: 240, unit: 'piece', carbs: 12, protein: 14, fat: 15, category: 'Snacks' },
  { id: 34, name: 'Spring Roll', calories: 180, unit: 'piece', carbs: 20, protein: 6, fat: 8, category: 'Snacks' },
  { id: 35, name: 'Shawarma', calories: 450, unit: 'piece', carbs: 40, protein: 20, fat: 24, category: 'Snacks' },

  // Beans & Porridge
  { id: 36, name: 'Beans Porridge', calories: 280, unit: 'serving', carbs: 35, protein: 18, fat: 6, category: 'Beans' },
  { id: 37, name: 'Beans & Plantain', calories: 380, unit: 'serving', carbs: 50, protein: 18, fat: 8, category: 'Beans' },
  { id: 38, name: 'Yam Porridge', calories: 320, unit: 'serving', carbs: 55, protein: 6, fat: 8, category: 'Porridge' },
  { id: 39, name: 'Yam & Egg Sauce', calories: 350, unit: 'serving', carbs: 48, protein: 12, fat: 12, category: 'Porridge' },

  // Breakfast
  { id: 40, name: 'Bread & Egg', calories: 320, unit: 'serving', carbs: 35, protein: 14, fat: 14, category: 'Breakfast' },
  { id: 41, name: 'Custard & Akara', calories: 280, unit: 'serving', carbs: 40, protein: 10, fat: 8, category: 'Breakfast' },
  { id: 42, name: 'Oats Porridge', calories: 200, unit: 'bowl', carbs: 36, protein: 8, fat: 4, category: 'Breakfast' },
  { id: 43, name: 'Indomie Noodles', calories: 350, unit: 'pack', carbs: 48, protein: 8, fat: 14, category: 'Breakfast' },
  { id: 44, name: 'Pap (Ogi)', calories: 120, unit: 'cup', carbs: 28, protein: 2, fat: 1, category: 'Breakfast' },
  { id: 45, name: 'Tea & Bread', calories: 200, unit: 'serving', carbs: 32, protein: 5, fat: 6, category: 'Breakfast' },

  // Drinks
  { id: 46, name: 'Zobo Drink', calories: 80, unit: 'glass', carbs: 20, protein: 0, fat: 0, category: 'Drinks' },
  { id: 47, name: 'Chapman', calories: 150, unit: 'glass', carbs: 38, protein: 0, fat: 0, category: 'Drinks' },
  { id: 48, name: 'Fresh Fruit Smoothie', calories: 180, unit: 'glass', carbs: 40, protein: 3, fat: 1, category: 'Drinks' },
  { id: 49, name: 'Kunu', calories: 130, unit: 'glass', carbs: 30, protein: 2, fat: 1, category: 'Drinks' },
  { id: 50, name: 'Tiger Nut Drink (Kunun Aya)', calories: 200, unit: 'glass', carbs: 30, protein: 4, fat: 8, category: 'Drinks' },
];



const MealLogger = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [search, setSearch] = useState('');
  const [customFoodsList, setCustomFoodsList] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [totalToday, setTotalToday] = useState(0);
  const [isLogging, setIsLogging] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [customFood, setCustomFood] = useState({ name: '', calories: '', carbs: '', protein: '', fat: '' });
  const [calGoal, setCalGoal] = useState(2400);

  useEffect(() => {
    if (user?.profile) {
      const bio = calculateUserBiometrics(user.profile);
      setCalGoal(bio.daily);
    }
  }, [user?.profile]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (user?.uid) {
        const log = await getDailyLog(user.uid);
        setTotalToday(log.caloriesConsumed || 0);

        const custom = await getCustomFoods(user.uid);
        setCustomFoodsList(custom);
      }
    };
    fetchInitialData();
    
    // Auto-load shared meal if routed via Chat
    if (state?.sharedMeal) {
      setTimeout(() => {
        setSearch(state.sharedMeal.name);
        setSelectedMeal(state.sharedMeal);
        // Clean state so it doesn't loop heavily
        navigate(window.location.pathname, { replace: true, state: {} });
      }, 300);
    }
  }, [user?.uid, state, navigate]);

  const allFoods = [...customFoodsList, ...NIGERIAN_FOODS];
  const dynamicCategories = [...new Set(allFoods.map(f => f.category))];

  const filteredFoods = allFoods.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'All' || f.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddMeal = async (food) => {
    if (!user?.uid) return;
    setIsLogging(true);
    try {
      await logUserMeal(user.uid, {
        name: food.name,
        calories: food.calories,
        macros: { carbs: food.carbs, protein: food.protein, fat: food.fat }
      });
      setTotalToday(prev => prev + food.calories);
      setSelectedMeal(null);
      setSearch('');
    } catch (err) {
      console.error("Error logging meal:", err);
    } finally {
      setIsLogging(false);
    }
  };

  const handleAddCustom = async () => {
    const cal = parseInt(customFood.calories) || 0;
    if (!customFood.name || cal <= 0 || !user?.uid) return;

    const food = {
      name: customFood.name,
      calories: cal,
      carbs: parseInt(customFood.carbs) || 0,
      protein: parseInt(customFood.protein) || 0,
      fat: parseInt(customFood.fat) || 0,
    };

    setIsLogging(true);
    try {
      await logUserMeal(user.uid, {
        name: food.name,
        calories: food.calories,
        macros: { carbs: food.carbs, protein: food.protein, fat: food.fat }
      });

      await saveCustomFood(user.uid, food);
      setCustomFoodsList(prev => [{ ...food, id: Date.now().toString(), category: 'Custom', unit: 'serving' }, ...prev]);

      setTotalToday(prev => prev + food.calories);
      setCustomFood({ name: '', calories: '', carbs: '', protein: '', fat: '' });
      setShowCustomForm(false);
    } catch (err) {
      console.error("Error logging custom meal:", err);
    } finally {
      setIsLogging(false);
    }
  };

  const pct = Math.min(totalToday / calGoal, 1) * 100;

  return (
    <div className="meal-container container animate-fade-in">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back</button>
        <h1 className="glow-emerald">Log Your Meal</h1>
        <div style={{ width: '40px' }} />
      </header>

      <div className="meal-content-grid" style={{ marginTop: '1.25rem' }}>
        <section className="food-search-section">
          {/* Search and custom action bar */}
          <div className="meal-search-bar">
            <div className="glass-card search-box" style={{ margin: 0 }}>
              <Search size={18} className="text-muted" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Find Nigerian favorites..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="action-btn primary meal-custom-btn"
            >
              {showCustomForm ? <X size={18} /> : <Plus size={18} />}
              <span>{showCustomForm ? 'Cancel' : 'Custom Entry'}</span>
            </button>
          </div>

          {/* Category chips */}
          <div className="category-scroll-container" style={{ marginBottom: '1.25rem' }}>
            <button
              onClick={() => setActiveCategory('All')}
              style={{
                padding: '0.4rem 0.875rem', borderRadius: '2rem', fontSize: '0.78rem',
                fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: activeCategory === 'All' ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.04)',
                color: activeCategory === 'All' ? 'white' : 'var(--text-secondary)',
                border: activeCategory === 'All' ? 'none' : '1px solid var(--border-subtle)',
              }}
            >All ({allFoods.length})</button>
            {dynamicCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '0.4rem 0.875rem', borderRadius: '2rem', fontSize: '0.78rem',
                  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: activeCategory === cat ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.04)',
                  color: activeCategory === cat ? 'white' : 'var(--text-secondary)',
                  border: activeCategory === cat ? 'none' : '1px solid var(--border-subtle)',
                }}
              >{cat}</button>
            ))}
          </div>



          {/* Custom food form */}
          <AnimatePresence>
            {showCustomForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="glass-card"
                style={{ padding: '1.5rem', marginBottom: '1.25rem', overflow: 'hidden', borderColor: 'var(--border-gold)' }}
              >
                <h4 style={{ marginBottom: '1rem', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.95rem' }}>
                  <Edit3 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  Custom Food Entry
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text" placeholder="Food name (e.g., Amala & Gbegiri)"
                    value={customFood.name}
                    onChange={e => setCustomFood({ ...customFood, name: e.target.value })}
                    style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                  />
                  <div className="responsive-grid-2" style={{ gap: '0.75rem' }}>
                    <input
                      type="number" placeholder="Calories (kcal)*"
                      value={customFood.calories}
                      onChange={e => setCustomFood({ ...customFood, calories: e.target.value })}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                    />
                    <input
                      type="number" placeholder="Protein (g)"
                      value={customFood.protein}
                      onChange={e => setCustomFood({ ...customFood, protein: e.target.value })}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                    />
                    <input
                      type="number" placeholder="Carbs (g)"
                      value={customFood.carbs}
                      onChange={e => setCustomFood({ ...customFood, carbs: e.target.value })}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                    />
                    <input
                      type="number" placeholder="Fat (g)"
                      value={customFood.fat}
                      onChange={e => setCustomFood({ ...customFood, fat: e.target.value })}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                    />
                  </div>
                  <button
                    onClick={handleAddCustom}
                    disabled={isLogging || !customFood.name || !customFood.calories}
                    style={{
                      padding: '0.875rem', borderRadius: '0.875rem',
                      background: (!customFood.name || !customFood.calories) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer',
                      opacity: (!customFood.name || !customFood.calories) ? 0.5 : 1,
                      transition: 'all 0.2s', fontFamily: 'inherit', fontSize: '0.9rem'
                    }}
                  >
                    <Check size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    {isLogging ? 'Logging...' : 'Log Custom Meal'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Food list */}
          <div className="food-results-list">
            <AnimatePresence>
              {filteredFoods.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}
                >
                  <Utensils size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p>No foods found. Try a different search or add a custom entry above!</p>
                </motion.div>
              ) : filteredFoods.map((food, index) => (
                <motion.div
                  key={food.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                  whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.06)' }}
                  onClick={() => setSelectedMeal(food)}
                  style={{ 
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1rem',
                    marginBottom: '0.75rem',
                    cursor: 'pointer',
                    borderRadius: '1rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    minHeight: 'min-content',
                    gap: '0.75rem',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '45px', height: '45px', borderRadius: '12px',
                      background: 'rgba(16,185,129,0.15)', color: '#10b981',
                      flexShrink: 0
                    }}>
                      <Utensils size={20} />
                    </div>
                    <div className="food-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</h4>
                      <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', lineHeight: '1.2' }}>
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{food.calories}kcal</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>{food.unit}</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>{food.category}</span>
                      </p>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: '#10b981', color: 'white',
                    flexShrink: 0, boxShadow: '0 2px 8px rgba(16,185,129,0.4)', transition: 'all 0.2s'
                  }}>
                    <Plus size={18} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Right: Summary */}
        <section className="meal-summary-section">
          <div className="glass-card summary-card">
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Today's Nutrition</h3>

            {/* Big calorie number */}
            <div className="total-display">
              <span className="total-val" style={{ color: pct >= 100 ? 'var(--accent-gold)' : 'white' }}>
                {totalToday.toLocaleString()}
              </span>
              <span className="total-label">/ {calGoal.toLocaleString()} kcal goal</span>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px',
                overflow: 'hidden', position: 'relative'
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    height: '100%', borderRadius: '4px',
                    background: pct >= 100
                      ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                      : 'linear-gradient(90deg, #10b981, #34d399)',
                    boxShadow: `0 0 12px ${pct >= 100 ? 'rgba creation(245,158,11,0.5)' : 'rgba(16,185,129,0.5)'}`,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{Math.round(pct)}% of daily goal</span>
                <span>{Math.max(calGoal - totalToday, 0)} kcal remaining</span>
              </div>
            </div>

            {/* Macro summary */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Macros Guide</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[
                  { label: 'Protein', color: '#10b981', icon: Beef, tip: 'Build & repair muscle' },
                  { label: 'Carbs', color: '#f59e0b', icon: Wheat, tip: 'Energy for workouts' },
                  { label: 'Fat', color: '#ef4444', icon: Droplets, tip: 'Hormone production' },
                ].map(macro => (
                  <div key={macro.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '0.625rem',
                      background: `${macro.color}15`, border: `1px solid ${macro.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <macro.icon size={16} style={{ color: macro.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{macro.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{macro.tip}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '1.5rem', lineHeight: '1.6' }}>
              Every meal you log moves you up the <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>campus leaderboard</span>! 🏆
            </p>
          </div>
        </section>
      </div>

      {/* Meal detail modal */}
      <AnimatePresence>
        {selectedMeal && (
          <div className="modal-overlay" onClick={() => setSelectedMeal(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card"
              onClick={e => e.stopPropagation()}
              style={{ padding: '2rem', maxWidth: '400px', width: '100%', borderRadius: '1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 700 }}>{selectedMeal.name}</h3>
                <button onClick={() => setSelectedMeal(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: '0.5rem', padding: '0.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Macros grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Calories', val: selectedMeal.calories, unit: 'kcal', color: '#10b981', icon: Flame },
                  { label: 'Protein', val: `${selectedMeal.protein}g`, unit: '', color: '#3b82f6', icon: Beef },
                  { label: 'Carbs', val: `${selectedMeal.carbs}g`, unit: '', color: '#f59e0b', icon: Wheat },
                  { label: 'Fat', val: `${selectedMeal.fat}g`, unit: '', color: '#ef4444', icon: Droplets },
                ].map(m => (
                  <div key={m.label} style={{
                    padding: '1rem', background: `${m.color}08`, borderRadius: '1rem',
                    border: `1px solid ${m.color}25`, textAlign: 'center'
                  }}>
                    <m.icon size={18} style={{ color: m.color, marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white' }}>{m.val}{m.unit}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                Per {selectedMeal.unit} • {selectedMeal.category}
              </div>

              <div className="drawer-actions">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  style={{
                    flex: 1, padding: '1rem',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#10b981', borderRadius: '0.875rem', fontWeight: 600, border: '1px solid rgba(16,185,129,0.3)',
                    cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                >
                  Share Setup
                </button>
                <button
                  disabled={isLogging}
                  onClick={() => handleAddMeal(selectedMeal)}
                  style={{
                    flex: 2, padding: '1rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white', borderRadius: '0.875rem', fontWeight: 700, border: 'none',
                    cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'inherit',
                    boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                    transition: 'all 0.2s',
                    opacity: isLogging ? 0.6 : 1
                  }}
                >
                  {isLogging ? 'Logging...' : `Add ${selectedMeal.calories} kcal`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      {selectedMeal && (
         <ShareModal 
           isOpen={shareModalOpen} 
           onClose={() => setShareModalOpen(false)} 
           type="meal" 
           payload={selectedMeal} 
         />
      )}
    </div>
  );
};

export default MealLogger;
