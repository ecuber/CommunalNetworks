const BRAND_DYNAMIC_COLORS = ['#48C1E1', '#95C93D', '#FFC60B', '#006880', '#0B3C61', '#E76127', '#D41A69']

const generateDynamicColor = (index: number) => BRAND_DYNAMIC_COLORS[index % BRAND_DYNAMIC_COLORS.length]

export const CATEGORY_PRESETS = [
  { label: 'Freshman Group', color: '#E76127' },
  { label: "Val/Santa's group", color: '#006880' },
  { label: "Naomie/Juliette's group", color: '#D41A69' },
  { label: "Cliff/Ayo's group", color: '#48C1E1' },
  { label: "Caleb/Milaura's group", color: '#95C93D' },
  { label: 'LaFe', color: '#FFC60B' },
  { label: 'Large Group', color: '#0B3C61' },
  { label: 'Prayer', color: '#333333' },
] as const

export const CATEGORY_PRESET_VALUES = CATEGORY_PRESETS.map(preset => preset.label)

export const CATEGORY_PRESET_COLOR_MAP = new Map(
  CATEGORY_PRESETS.map(preset => [preset.label, preset.color] as const)
)

export function assignCategoryColors(categories: string[]): Map<string, string> {
  const map = new Map<string, string>()

  CATEGORY_PRESETS.forEach(({ label, color }) => {
    map.set(label, color)
  })

  const dynamicCategories = categories.filter(category => !map.has(category))
  dynamicCategories.forEach((category, index) => {
    map.set(category, generateDynamicColor(index))
  })

  return map
}
