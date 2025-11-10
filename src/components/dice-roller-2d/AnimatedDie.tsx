import React, { useEffect, useState } from 'react';
import './Dice2DOverlay.css';

type AnimatedDieProps = {
  type: string;
  finalValue: number;
  onComplete: () => void;
  style: React.CSSProperties;
};

const DIE_SHAPES: Record<string, string> = {
  d4: 'M 50,0 L 100,86.6 L 0,86.6 Z',
  d6: 'M 0,0 L 100,0 L 100,100 L 0,100 Z',
  d8: 'M 50,0 L 100,50 L 50,100 L 0,50 Z',
  d10: 'M 50,0 L 100,38 L 81,100 L 19,100 L 0,38 Z',
  d12: 'M 50,0 L 100,38 L 81,100 L 19,100 L 0,38 Z',
  d20: 'M 50,0 L 85.4,14.6 L 100,50 L 85.4,85.4 L 50,100 L 14.6,85.4 L 0,50 L 14.6,14.6 Z',
};

export const AnimatedDie: React.FC<AnimatedDieProps> = ({ type, finalValue, onComplete, style }) => {
  const [currentValue, setCurrentValue] = useState<number | string>('?');
  const [isRolling, setIsRolling] = useState(true);
  const [isFading, setIsFading] = useState(false);

  const dieType = parseInt(type.replace('d', ''), 10);

  useEffect(() => {
    let spinCount = 0;
    const spinInterval = setInterval(() => {
      spinCount += 1;
      setCurrentValue(Math.floor(Math.random() * dieType) + 1);

      if (spinCount > 15) {
        clearInterval(spinInterval);
        setIsRolling(false);
      }
    }, 100);

    return () => clearInterval(spinInterval);
  }, [dieType]);

  useEffect(() => {
    if (isRolling) return;

    setCurrentValue(finalValue);

    const holdTimer = setTimeout(() => {
      setIsFading(true);
    }, 2000);

    return () => clearTimeout(holdTimer);
  }, [isRolling, finalValue]);

  useEffect(() => {
    if (!isFading) return;

    const fadeOutTimer = setTimeout(() => {
      onComplete();
    }, 1000);

    return () => clearTimeout(fadeOutTimer);
  }, [isFading, onComplete]);

  const isSettled = !isRolling && !isFading;
  const isCrit = finalValue === dieType;
  const isFail = finalValue === 1;

  const shapePath = DIE_SHAPES[type] || DIE_SHAPES.d6;
  const classes = [
    'dice-2d-die',
    isRolling && 'is-rolling',
    isFading && 'is-fading',
    isSettled && 'is-settled',
    isSettled && isCrit && 'is-crit',
    isSettled && isFail && 'is-fail',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg className={classes} style={style} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <path d={shapePath} className="dice-2d-shape-bg" />
      <path d={shapePath} className="dice-2d-shape-shadow" />
      <foreignObject x="0" y="0" width="100" height="100">
        <span className="dice-2d-value">{currentValue}</span>
      </foreignObject>
    </svg>
  );
};
