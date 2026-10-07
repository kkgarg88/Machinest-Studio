export type Field = {
  key: string
  label: string
  type: 'number' | 'select'
  step?: string
  default?: string
  options?: { value: string; label: string }[]
}

const offsets = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map(v => ({ value: v, label: v }))

const retractModes = [
  { value: 'G99', label: 'G99 - Return to R Plane before next hole' },
  { value: 'G98', label: 'G98 - Return to Initial Z before next hole' },
]

export const definitions: Record<string, Field[]> = {
  'milling-studio:G81': [
    { key: 'progNum', label: 'Program No', type: 'number', step: '1' },
    { key: 'radius', label: 'Radius', type: 'number', step: '0.001' },
    { key: 'holes', label: 'Holes', type: 'number', step: '1' },
    { key: 'startAngle', label: 'Start Angle', type: 'number', step: '0.001', default: '0' },
    { key: 'depth', label: 'Depth (Minus)', type: 'number', step: '0.001' },
    { key: 'retractlevel', label: 'Retract Level (R)', type: 'number', step: '0.001' },
    { key: 'safeZ', label: 'Safe Z', type: 'number', step: '0.1', default: '30' },
    { key: 'workOffset', label: 'Work Offset', type: 'select', default: 'G54', options: offsets },
    { key: 'retractMode', label: 'Retract Mode', type: 'select', default: 'G99', options: retractModes },
    { key: 'feed', label: 'Feed', type: 'number', step: '0.1' },
    { key: 'rpm', label: 'RPM', type: 'number', step: '1' },
  ],

  'milling-studio:G83/G73': [
    {
      key: 'cycleType', label: 'Cycle Type', type: 'select', default: 'G83',
      options: [
        { value: 'G83', label: 'G83 - Deep Hole Peck (Full Retract)' },
        { value: 'G73', label: 'G73 - High Speed Peck (Chip Break)' },
      ],
    },
    { key: 'progNum', label: 'Program No', type: 'number', step: '1' },
    { key: 'radius', label: 'Radius', type: 'number', step: '0.001' },
    { key: 'holes', label: 'Holes', type: 'number', step: '1' },
    { key: 'startAngle', label: 'Start Angle', type: 'number', step: '0.001', default: '0' },
    { key: 'depth', label: 'Depth (Minus)', type: 'number', step: '0.001' },
    { key: 'peckDepth', label: 'Peck Depth (Q)', type: 'number', step: '0.001' },
    { key: 'retractlevel', label: 'Retract Level (R)', type: 'number', step: '0.001' },
    { key: 'safeZ', label: 'Safe Z', type: 'number', step: '0.1', default: '30' },
    { key: 'workOffset', label: 'Work Offset', type: 'select', default: 'G54', options: offsets },
    { key: 'retractMode', label: 'Retract Mode', type: 'select', default: 'G99', options: retractModes },
    { key: 'feed', label: 'Feed', type: 'number', step: '0.1' },
    { key: 'rpm', label: 'RPM', type: 'number', step: '1' },
  ],

  'milling-studio:ELLIPSE': [
    {
      key: 'type', label: 'Type', type: 'select', default: 'ID',
      options: [{ value: 'ID', label: 'ID - Inside (start from center)' }],
    },
    { key: 'progNum', label: 'Program No', type: 'number', step: '1' },
    { key: 'xRadius', label: 'X Radius', type: 'number', step: '0.001' },
    { key: 'yRadius', label: 'Y Radius', type: 'number', step: '0.001' },
    { key: 'step', label: 'Angle Step (deg)', type: 'number', step: '0.1', default: '2' },
    { key: 'depth', label: 'Depth (Minus)', type: 'number', step: '0.001' },
    { key: 'depthPerPass', label: 'Depth per Pass', type: 'number', step: '0.001' },
    { key: 'retractlevel', label: 'Retract Level (R)', type: 'number', step: '0.001', default: '2' },
    { key: 'safeZ', label: 'Safe Z', type: 'number', step: '0.1', default: '50' },
    { key: 'cutterDia', label: 'Cutter Dia (for check only)', type: 'number', step: '0.001' },
    { key: 'workOffset', label: 'Work Offset', type: 'select', default: 'G54', options: offsets },
    { key: 'plungeFeed', label: 'Plunge Feed', type: 'number', step: '0.1' },
    { key: 'feed', label: 'Cutting Feed', type: 'number', step: '0.1' },
    { key: 'rpm', label: 'RPM', type: 'number', step: '1' },
  ],
    'turning-studio:CHAMFER': [
    { key: 'progNum', label: 'Program No', type: 'number', step: '1' },
    { key: 'od', label: 'OD (Outer Diameter)', type: 'number', step: '0.001' },
    { key: 'noseRadius', label: 'Tool Nose Radius (R)', type: 'number', step: '0.01', default: '0.4' },
    {
      key: 'mode', label: 'Input Mode', type: 'select', default: 'a_angle',
      options: [
        { value: 'a_angle', label: 'A (Z-leg) + Angle' },
        { value: 'b_angle', label: 'B (X-leg) + Angle' },
        { value: 'ab', label: 'A + B (angle unknown)' },
      ],
    },
    { key: 'a', label: 'A (Z-direction leg)', type: 'number', step: '0.001' },
    { key: 'b', label: 'B (X-direction leg)', type: 'number', step: '0.001' },
    { key: 'angle', label: 'Angle (deg, if using A+angle or B+angle)', type: 'number', step: '0.1' },
    {
      key: 'spindleMode', label: 'Spindle Mode', type: 'select', default: 'G96',
      options: [
        { value: 'G96', label: 'G96 - Constant Surface Speed' },
        { value: 'G97', label: 'G97 - Direct RPM' },
      ],
    },
    { key: 'speed', label: 'Speed (S value)', type: 'number', step: '1' },
    { key: 'feed', label: 'Feed (mm/rev)', type: 'number', step: '0.01' },
    { key: 'workOffset', label: 'Work Offset', type: 'select', default: 'G54', options: ['G54','G55','G56','G57','G58','G59'].map(v => ({ value: v, label: v })) },
    { key: 'safeX', label: 'Safe X Clearance (from OD)', type: 'number', step: '0.1', default: '3' },
    { key: 'safeZ', label: 'Safe Z Clearance (from face)', type: 'number', step: '0.1', default: '5' },
  ],
}
