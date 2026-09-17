export const WORKOUT_CATEGORIES = [
  {
    id: 'cardio',
    name: 'Cardio & Endurance',
    icon: '🏃‍♂️',
    color: '#10b981',
    subcategories: [
      {
        id: 'c_outdoor',
        name: 'Outdoor Running',
        workouts: [
          { id: 'jog_light', name: 'Light Jogging', calPerMin: 7, icon: '⏱️' },
          { id: 'run_pace', name: 'Paced Running (5km/h)', calPerMin: 11, icon: '🏃' },
          { id: 'sprint_hiit', name: 'Sprint Intervals', calPerMin: 15, icon: '⚡' },
          { id: 'walk_brisk', name: 'Brisk Campus Walk', calPerMin: 5, icon: '🚶' }
        ]
      },
      {
        id: 'c_equipment',
        name: 'Gym Cardio',
        workouts: [
          { id: 'treadmill', name: 'Treadmill Running', calPerMin: 10, icon: '🏃' },
          { id: 'cycling_stat', name: 'Stationary Bike', calPerMin: 8, icon: '🚴' },
          { id: 'elliptical', name: 'Elliptical / Stair Climber', calPerMin: 9, icon: '🪜' },
          { id: 'rowing', name: 'Rowing Machine', calPerMin: 12, icon: '🛶' }
        ]
      },
      {
        id: 'c_pool',
        name: 'Swimming',
        workouts: [
          { id: 'swim_freestyle', name: 'Freestyle Swimming', calPerMin: 10, icon: '🏊' },
          { id: 'swim_laps', name: 'Laps (Moderate)', calPerMin: 8, icon: '🌊' }
        ]
      }
    ]
  },
  {
    id: 'weightlifting',
    name: 'Weightlifting & Hypertrophy',
    icon: '🏋️‍♂️',
    color: '#f59e0b',
    subcategories: [
      {
        id: 'w_chest',
        name: 'Chest',
        workouts: [
          { id: 'bench_flat', name: 'Flat Barbell Bench Press', calPerMin: 6, icon: '⏺️' },
          { id: 'bench_incline', name: 'Incline Dumbbell Press', calPerMin: 6, icon: '⏫' },
          { id: 'pec_deck', name: 'Pec Deck Machine Fly', calPerMin: 5, icon: '🦋' },
          { id: 'cable_cross', name: 'Cable Crossover', calPerMin: 5, icon: '✖️' },
          { id: 'pushups', name: 'Push-Ups (Bodyweight)', calPerMin: 7, icon: '💪' }
        ]
      },
      {
        id: 'w_back',
        name: 'Back',
        workouts: [
          { id: 'deadlift', name: 'Conventional Deadlift', calPerMin: 8, icon: '🏋️' },
          { id: 'lat_pull', name: 'Lat Pulldown', calPerMin: 5, icon: '🔽' },
          { id: 'barbell_row', name: 'Bent-Over Barbell Row', calPerMin: 7, icon: '🚣' },
          { id: 'seated_row', name: 'Seated Cable Row', calPerMin: 5, icon: '🛶' },
          { id: 'pullups', name: 'Pull-Ups / Chin-Ups', calPerMin: 8, icon: '⏫' }
        ]
      },
      {
        id: 'w_legs',
        name: 'Legs & Glutes',
        workouts: [
          { id: 'squat_barbell', name: 'Barbell Back Squat', calPerMin: 8, icon: '🦵' },
          { id: 'leg_press', name: 'Machine Leg Press', calPerMin: 6, icon: '🛡️' },
          { id: 'lunge_db', name: 'Dumbbell Walking Lunges', calPerMin: 7, icon: '🚶‍♂️' },
          { id: 'leg_ext', name: 'Leg Extensions', calPerMin: 4, icon: '💺' },
          { id: 'ham_curl', name: 'Hamstring Curls', calPerMin: 4, icon: '🔄' },
          { id: 'calf_raise', name: 'Standing Calf Raises', calPerMin: 4, icon: '🧍' }
        ]
      },
      {
        id: 'w_shoulders',
        name: 'Shoulders (Delts)',
        workouts: [
          { id: 'ohp_barbell', name: 'Standing Overhead Press', calPerMin: 6, icon: '⬆️' },
          { id: 'lat_raise', name: 'Dumbbell Lateral Raises', calPerMin: 4, icon: '👐' },
          { id: 'front_raise', name: 'Dumbbell Front Raises', calPerMin: 4, icon: '⬆️' },
          { id: 'face_pull', name: 'Cable Face Pulls', calPerMin: 5, icon: '🎭' }
        ]
      },
      {
        id: 'w_arms',
        name: 'Arms (Biceps & Triceps)',
        workouts: [
          { id: 'bicep_curl', name: 'Standing Barbell Curl', calPerMin: 4, icon: '💪' },
          { id: 'hammer_curl', name: 'Dumbbell Hammer Curls', calPerMin: 4, icon: '🔨' },
          { id: 'tricep_pushdown', name: 'Cable Tricep Pushdowns', calPerMin: 4, icon: '⬇️' },
          { id: 'skullcrushers', name: 'EZ-Bar Skullcrushers', calPerMin: 4, icon: '💀' },
          { id: 'dips', name: 'Tricep Dips', calPerMin: 6, icon: '⏬' }
        ]
      },
      {
        id: 'w_core',
        name: 'Core & Abs',
        workouts: [
          { id: 'plank', name: 'Bodyweight Planks', calPerMin: 5, icon: '➖' },
          { id: 'crunches', name: 'Abdominal Crunches', calPerMin: 4, icon: '🔄' },
          { id: 'russian_twist', name: 'Russian Twists', calPerMin: 5, icon: '🌪️' },
          { id: 'leg_raises', name: 'Hanging Leg Raises', calPerMin: 6, icon: '🦵' }
        ]
      }
    ]
  },
  {
    id: 'sports',
    name: 'Sports & Leisure',
    icon: '⚽',
    color: '#3b82f6',
    subcategories: [
      {
        id: 's_team',
        name: 'Team Sports',
        workouts: [
          { id: 'football', name: 'Football (Soccer) Match', calPerMin: 12, icon: '⚽' },
          { id: 'basketball', name: 'Basketball Game', calPerMin: 11, icon: '🏀' },
          { id: 'volleyball', name: 'Volleyball', calPerMin: 8, icon: '🏐' }
        ]
      },
      {
        id: 's_racket',
        name: 'Racket Sports',
        workouts: [
          { id: 'tennis', name: 'Lawn Tennis', calPerMin: 10, icon: '🎾' },
          { id: 'badminton', name: 'Badminton', calPerMin: 9, icon: '🏸' },
          { id: 'pingpong', name: 'Table Tennis', calPerMin: 6, icon: '🏓' }
        ]
      }
    ]
  },
  {
    id: 'yoga',
    name: 'Yoga & Flexibility',
    icon: '🧘‍♀️',
    color: '#8b5cf6',
    subcategories: [
      {
        id: 'y_body',
        name: 'Stretching',
        workouts: [
          { id: 'yoga_flow', name: 'Vinyasa Yoga Flow', calPerMin: 5, icon: '🧘' },
          { id: 'stretching', name: 'Dynamic Stretching', calPerMin: 3, icon: '🤸' },
          { id: 'pilates', name: 'Pilates Core Routine', calPerMin: 6, icon: '🎯' }
        ]
      }
    ]
  }
];
