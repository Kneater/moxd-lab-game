// Three.js Y-up coordinates: Blender (x, y, z) becomes (x, z, -y).
// The trigger is anchored to the green sensor tray next to the Raspberry board.
export const STATION_POSITION={x:4.79,y:.824,z:-5.33};
export const PLAYER_START={x:3.8,z:-5.4};
export const STATION_APPROACH={...PLAYER_START};
export const STATION_REACH=2.15;
export const UI_ACCENT='#c8b5ef';
export const SLOT_SIZES={controller:[.78,.87],sensor:[.59,.69],led:[.44,.28]};

// Exported kit placement; undo this transform for the separate minigame table.
export const KIT_ORIGIN={x:4.79,y:.774,z:-5.33};
export const KIT_ROTATION=-Math.PI/2;
