export const SESSION_TYPES = {
  upper: {
    label: 'Upper Body',
    tag: 'upper-body',
    exercises: [
      'DB Bench Press',
      'Cable Row',
      'DB Shoulder Press',
      'Lat Pulldown',
      'Lateral Raise',
      'Face Pull',
      'Tricep Pushdown',
      'Bicep Curl',
    ],
    cardio: {
      type: 'Interval Run',
      fields: ['distance', 'time', 'felt', 'notes'],
    },
  },
  lower: {
    label: 'Lower Body',
    tag: 'lower-body',
    exercises: [
      'Goblet Squat',
      'Romanian Deadlift (DB)',
      'Leg Press',
      'Leg Curl (machine)',
      'Walking Lunges',
      'Calf Raise',
      'Glute Bridge',
      'Plank (seconds)',
    ],
    cardio: {
      type: 'Easy Run',
      fields: ['distance', 'time', 'pace', 'notes'],
    },
  },
  full: {
    label: 'Full Body',
    tag: 'full-body',
    exercises: [
      'DB Split Squat (each leg)',
      'Single-arm DB Row (each)',
      'Incline DB Press',
      'Romanian Deadlift (DB)',
      'Arnold Press',
      'Leg Raise',
      'Farmer Carry',
      'Calf Raise',
    ],
    cardio: {
      type: 'Run or Badminton',
      fields: ['activity', 'distance', 'time', 'notes'],
    },
  },
}

export const SESSION_TYPE_KEYS = Object.keys(SESSION_TYPES)

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

export const PROTEIN_TARGET_PER_KG = 1.6
export const DEFAULT_BODYWEIGHT_KG = 75
export const CALORIE_DEFICIT_TARGET = 350
export const WATER_TARGET_L = 2.75
