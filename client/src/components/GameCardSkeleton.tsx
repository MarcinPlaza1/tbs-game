import type { FC } from 'react';

const GameCardSkeleton: FC = () => (
  <div className="card h-40 animate-pulse" aria-hidden="true" />
);

export default GameCardSkeleton;