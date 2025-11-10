import React from 'react';
import { AnimatedDie } from './AnimatedDie';
import './Dice2DOverlay.css';

type Dice2DOverlayProps = {
  activeRolls: Array<{
    id: string;
    type: string;
    value: number;
    isSingleRoll?: boolean;
    indexInGroup?: number;
  }>;
  onAnimationComplete: (id: string) => void;
};

export const Dice2DOverlay: React.FC<Dice2DOverlayProps> = ({ activeRolls, onAnimationComplete }) => {
  return (
    <div className="dice-2d-overlay">
      {activeRolls.map((roll) => {
        let top: string;
        let left: string;

        if (roll.isSingleRoll) {
          top = '40%';
          left = '45%';
        } else {
          const i = roll.indexInGroup ?? 0;
          top = `${10 + i * 15}%`;
          left = `${40 + i * 5}%`;
        }

        return (
          <AnimatedDie
            key={roll.id}
            type={roll.type}
            finalValue={roll.value}
            onComplete={() => onAnimationComplete(roll.id)}
            style={{ top, left }}
          />
        );
      })}
    </div>
  );
};
